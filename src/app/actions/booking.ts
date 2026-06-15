'use server';

import { db as prisma, Prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function createBooking(data: {
  leadId: string;
  unitId: string;
  organizationId: string;
  type: 'SOFT' | 'HARD' | 'SERVICE';
  duration: number; // hours for SOFT, days for HARD
}) {
  try {
    // 1. Проверяем, нет ли уже активной брони на это помещение в Booking
    const activeBookings: any[] = await prisma.$queryRaw`
      SELECT b.id, l.name as "leadName", m.name as "managerName"
      FROM "Booking" b
      JOIN "Lead" l ON b."leadId" = l.id
      LEFT JOIN "Manager" m ON l."managerId" = m.id
      WHERE b."unitId" = ${data.unitId} AND b.status = 'ACTIVE'
      LIMIT 1
    `;

    if (activeBookings.length > 0) {
      const b = activeBookings[0];
      return { 
        success: false, 
        error: 'ALREADY_BOOKED', 
        message: `Этот объект уже забронирован клиентом ${b.leadName}${b.managerName ? `, менеджер: ${b.managerName}` : ''}.`
      };
    }

    // 2. Рассчитываем expiresAt
    let expiresAt = new Date();
    if (data.type === 'SOFT') {
      expiresAt = new Date(Date.now() + data.duration * 60 * 60 * 1000);
    } else if (data.type === 'HARD') {
      expiresAt = new Date(Date.now() + data.duration * 24 * 60 * 60 * 1000);
    } else {
      // Service booking: 99 years duration
      expiresAt = new Date(Date.now() + 99 * 365 * 24 * 60 * 60 * 1000);
    }

    // 3. Создаем запись в Booking
    const bookingId = crypto.randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "Booking" ("id", "leadId", "unitId", "expiresAt", "type", "status", "organizationId", "createdAt", "updatedAt")
      VALUES (${bookingId}, ${data.leadId}, ${data.unitId}, ${expiresAt}, ${data.type}, 'ACTIVE', ${data.organizationId}, NOW(), NOW())
    `;

    // 4. Проверяем наличие сделки. Если её нет, создаем её
    const existingDeals: any[] = await prisma.$queryRaw`
      SELECT id FROM "Deal" 
      WHERE "leadId" = ${data.leadId} AND "unitId" = ${data.unitId} AND status NOT IN ('SUCCESS', 'FAILED', 'CANCELLED')
      LIMIT 1
    `;

    let dealId = '';
    let dealStatus = 'NEW_LEAD';
    if (data.type === 'SOFT') {
      dealStatus = 'PRE_RESERVATION'; // Soft Booking
    } else if (data.type === 'HARD') {
      dealStatus = 'RESERVATION'; // Hard Booking
    } else {
      dealStatus = 'CLIENT_CONFIRMATION';
    }

    if (existingDeals.length > 0) {
      dealId = existingDeals[0].id;
      // Обновляем статус существующей сделки
      await prisma.$executeRaw`
        UPDATE "Deal" 
        SET "status" = ${dealStatus}::"DealStatus", "updatedAt" = NOW()
        WHERE id = ${dealId}
      `;
    } else {
      dealId = crypto.randomUUID();
      await prisma.$executeRaw`
        INSERT INTO "Deal" ("id", "leadId", "unitId", "organizationId", "status", "createdAt", "updatedAt")
        VALUES (${dealId}, ${data.leadId}, ${data.unitId}, ${data.organizationId}, ${dealStatus}::"DealStatus", NOW(), NOW())
      `;
    }

    // 5. Меняем статус квартиры в Unit
    let unitStatus = 'SOFT_BOOKED';
    if (data.type === 'HARD') {
      unitStatus = 'RESERVATION_PAID';
    } else if (data.type === 'SERVICE') {
      unitStatus = 'SERVICE';
    }

    await prisma.$executeRaw`
      UPDATE "Unit" 
      SET status = ${unitStatus}::"UnitStatus", "thinkingFlag" = false, "updatedAt" = NOW()
      WHERE id = ${data.unitId}
    `;

    // 6. Также переводим лида в статус IN_PROGRESS (Сделка/Клиент), если он был в старых этапах
    await prisma.$executeRaw`
      UPDATE "Lead"
      SET "status" = 'IN_PROGRESS'::"LeadStatus", "updatedAt" = NOW()
      WHERE id = ${data.leadId} AND "status" IN ('NEW', 'IN_QUALIFICATION', 'QUALIFIED')
    `;

    revalidatePath('/shakhmatka');
    revalidatePath('/deals');
    revalidatePath('/clients');
    revalidatePath('/');
    
    return { success: true, bookingId };
  } catch (error: any) {
    console.error('Booking error:', error);
    if (error.message && error.message.includes('unique constraint')) {
      return { success: false, error: 'ALREADY_BOOKED', message: 'Этот объект уже забронирован другим клиентом (ошибка параллельного бронирования).' };
    }
    return { success: false, error: 'SERVER_ERROR', message: 'Ошибка сервера при создании бронирования.' };
  }
}

export async function checkAndReleaseExpiredBookings() {
  try {
    // 1. Находим все активные просроченные брони
    const expiredBookings: any[] = await prisma.$queryRaw`
      SELECT id, "unitId", "leadId", "type"
      FROM "Booking"
      WHERE status = 'ACTIVE' AND "expiresAt" < NOW()
    `;

    if (expiredBookings.length === 0) return { success: true, releasedCount: 0 };

    for (const b of expiredBookings) {
      // Обновляем статус брони на EXPIRED
      await prisma.$executeRaw`
        UPDATE "Booking" SET status = 'EXPIRED', "updatedAt" = NOW() WHERE id = ${b.id}
      `;

      // Освобождаем квартиру
      await prisma.$executeRaw`
        UPDATE "Unit" SET status = 'FREE', "thinkingFlag" = ${b.type === 'SOFT'}, "updatedAt" = NOW() WHERE id = ${b.unitId}
      `;

      // Обновляем сделку
      if (b.type === 'SOFT') {
        // Устная бронь: переводим сделку обратно в Личную консультацию (CONSULTATION)
        await prisma.$executeRaw`
          UPDATE "Deal" 
          SET status = 'CONSULTATION'::"DealStatus", "updatedAt" = NOW()
          WHERE "leadId" = ${b.leadId} AND "unitId" = ${b.unitId} AND status NOT IN ('SUCCESS', 'FAILED', 'CANCELLED')
        `;
      } else {
        // Жесткая бронь: переводим сделку в LOST (FAILED)
        await prisma.$executeRaw`
          UPDATE "Deal" 
          SET status = 'FAILED'::"DealStatus", "updatedAt" = NOW()
          WHERE "leadId" = ${b.leadId} AND "unitId" = ${b.unitId} AND status NOT IN ('SUCCESS', 'FAILED', 'CANCELLED')
        `;
        // Лид тоже переходит в LOST
        await prisma.$executeRaw`
          UPDATE "Lead"
          SET status = 'LOST'::"LeadStatus", "updatedAt" = NOW()
          WHERE id = ${b.leadId}
        `;
      }
    }

    revalidatePath('/shakhmatka');
    revalidatePath('/deals');
    revalidatePath('/clients');
    revalidatePath('/');

    return { success: true, releasedCount: expiredBookings.length };
  } catch (error) {
    console.error('Error releasing expired bookings:', error);
    return { success: false, error: 'Failed to release expired bookings' };
  }
}

// Получить список всех лидов для выпадающего списка
export async function getLeadsList(organizationId: string) {
  return await prisma.$queryRaw`
    SELECT * FROM "Lead" 
    WHERE "organizationId" = ${organizationId} 
    ORDER BY "createdAt" DESC
  `;
}
