'use server';

import { db as prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

// Получить все сделки организации через прямой JOIN SQL (очень быстро и безопасно для PgBouncer)
export async function getDeals(organizationId: string) {
  try {
    const rawDeals: any[] = await prisma.$queryRaw`
      SELECT 
        d.id as "dealId",
        d.status as "dealStatus",
        d."organizationId" as "dealOrgId",
        d."managerId" as "dealManagerId",
        d."paymentType" as "dealPaymentType",
        d."downPayment" as "dealDownPayment",
        d."totalAmount" as "dealTotalAmount",
        d."mortgageBank" as "dealMortgageBank",
        d."mortgageStatus" as "dealMortgageStatus",
        d."mortgageComment" as "dealMortgageComment",
        d."createdAt" as "dealCreatedAt",
        d."updatedAt" as "dealUpdatedAt",
        d."previousStatus" as "dealPreviousStatus",
        l.id as "leadId",
        l.name as "leadName",
        l.phone as "leadPhone",
        l.email as "leadEmail",
        l.iin as "leadIin",
        u.id as "unitId",
        u.number as "unitNumber",
        u.floor as "unitFloor",
        u.rooms as "unitRooms",
        u.type as "unitType",
        u.area as "unitArea",
        u.price as "unitPrice"
      FROM "Deal" d
      LEFT JOIN "Lead" l ON d."leadId" = l.id
      LEFT JOIN "Unit" u ON d."unitId" = u.id
      WHERE d."organizationId" = ${organizationId}
      ORDER BY d."updatedAt" DESC
    `;

    return rawDeals.map(d => ({
      id: d.dealId,
      status: d.dealStatus,
      organizationId: d.dealOrgId,
      managerId: d.dealManagerId,
      paymentType: d.dealPaymentType,
      downPayment: d.dealDownPayment,
      totalAmount: d.dealTotalAmount,
      mortgageBank: d.dealMortgageBank || '',
      mortgageStatus: d.dealMortgageStatus || 'NONE',
      mortgageComment: d.dealMortgageComment || '',
      createdAt: d.dealCreatedAt,
      updatedAt: d.dealUpdatedAt,
      previousStatus: d.dealPreviousStatus || null,
      clientName: d.leadName, // Добавили обратную совместимость для DealsClient
      lead: d.leadId ? {
        id: d.leadId,
        name: d.leadName,
        phone: d.leadPhone,
        email: d.leadEmail,
        iin: d.leadIin
      } : null,
      unit: d.unitId ? {
        id: d.unitId,
        number: d.unitNumber,
        floor: d.unitFloor,
        rooms: d.unitRooms,
        type: d.unitType,
        area: d.unitArea,
        price: d.unitPrice
      } : null
    }));
  } catch (error) {
    console.error('getDeals SQL error:', error);
    return [];
  }
}

// Стадии сделки и их веса для валидации
const STAGE_HIERARCHY: Record<string, number> = {
  NEW_LEAD: 0,
  CLARIFICATION: 1,
  CALL: 2,
  SECOND_CALL: 3,
  THIRD_CALL: 4,
  CONSULTATION: 5,
  PRE_RESERVATION: 6,
  RESERVATION: 7,
  CONTRACT_PREPARATION: 8,
  CONTRACT: 9,
  CLIENT_CONFIRMATION: 10,
  WAITING_PAYMENT: 11,
  PAYMENT_CONFIRMED: 12,
  SUCCESS: 13,
  FAILED: 14,
  CANCELLED: 15
};

// Обновить статус сделки (перетаскивание по воронке) напрямую через SQL
export async function updateDealStatus(dealId: string, status: any, previousStatus?: string) {
  try {
    // 1. Проверяем бизнес-правила переходов по воронке
    const deals: any[] = await prisma.$queryRaw`
      SELECT "unitId" FROM "Deal" WHERE "id" = ${dealId} LIMIT 1
    `;
    const deal = deals[0];

    if (deal) {
      const targetRank = STAGE_HIERARCHY[status] !== undefined ? STAGE_HIERARCHY[status] : 0;

      // Начиная со стадии 'Личная консультация' (ранг 5) и дальше - обязательно должен быть привязан объект (квартира)
      if (targetRank >= 5 && targetRank <= 13 && !deal.unitId) {
        return {
          success: false,
          error: 'NO_UNIT_LINKED',
          message: 'Необходимо привязать конкретный объект недвижимости к сделке перед переходом на этот этап воронки!'
        };
      }
    }

    // 2. Обновляем статус в БД (+ previousStatus если возврат на Личную консультацию)
    if (previousStatus) {
      await prisma.$executeRaw`
        UPDATE "Deal"
        SET "status" = ${status}::"DealStatus", "previousStatus" = ${previousStatus}, "updatedAt" = NOW()
        WHERE "id" = ${dealId}
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE "Deal"
        SET "status" = ${status}::"DealStatus", "updatedAt" = NOW()
        WHERE "id" = ${dealId}
      `;
    }

    // 2.5 Синхронизация статуса лида со статусом сделки (раздел 3 ТЗ)
    if (status === 'FAILED' || status === 'CANCELLED') {
      await prisma.$executeRaw`
        UPDATE "Lead"
        SET "status" = 'LOST', "updatedAt" = NOW()
        WHERE "id" = (SELECT "leadId" FROM "Deal" WHERE "id" = ${dealId} LIMIT 1)
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE "Lead"
        SET "status" = 'CONVERTED', "updatedAt" = NOW()
        WHERE "id" = (SELECT "leadId" FROM "Deal" WHERE "id" = ${dealId} LIMIT 1)
      `;
    }

    revalidatePath('/deals');
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Update deal status SQL error:', error);
    return { success: false, error: 'SERVER_ERROR', message: 'Ошибка при обновлении статуса в базе данных' };
  }
}

// Обновить статус ипотеки
export async function updateDealMortgage(data: {
  dealId: string;
  bank: string;
  status: string;
  comment: string;
}) {
  try {
    await prisma.$executeRaw`
      UPDATE "Deal"
      SET 
        "mortgageBank" = ${data.bank}, 
        "mortgageStatus" = ${data.status}, 
        "mortgageComment" = ${data.comment},
        "updatedAt" = NOW()
      WHERE "id" = ${data.dealId}
    `;
    revalidatePath('/deals');
    return { success: true };
  } catch (error) {
    console.error('Update deal mortgage SQL error:', error);
    return { success: false };
  }
}

// Получить всех клиентов сделки (основной из Deal + дополнительные из DealClient)
export async function getDealClients(dealId: string) {
  try {
    // Получаем основного клиента из самой сделки
    const dealRows: any[] = await prisma.$queryRaw`
      SELECT d."leadId", l.name, l.phone, l.email, l.iin
      FROM "Deal" d
      JOIN "Lead" l ON d."leadId" = l.id
      WHERE d."id" = ${dealId}
      LIMIT 1
    `;

    // Получаем дополнительных клиентов из DealClient
    const extraClients: any[] = await prisma.$queryRaw`
      SELECT dc.id, dc."leadId", dc."isPrimary", dc."createdAt",
             l.name, l.phone, l.email, l.iin
      FROM "DealClient" dc
      JOIN "Lead" l ON dc."leadId" = l.id
      WHERE dc."dealId" = ${dealId}
      ORDER BY dc."isPrimary" DESC, dc."createdAt" ASC
    `;

    // Если основной клиент уже есть в DealClient — не дублируем
    const primaryLeadId = dealRows[0]?.leadId;
    const primaryInDealClient = extraClients.find(c => c.leadId === primaryLeadId);

    let allClients = [...extraClients];

    if (!primaryInDealClient && dealRows[0]) {
      // Добавляем основного клиента из Deal как первый с isPrimary=true
      allClients = [
        {
          id: `deal-primary-${dealId}`,
          leadId: dealRows[0].leadId,
          isPrimary: true,
          name: dealRows[0].name,
          phone: dealRows[0].phone,
          email: dealRows[0].email,
          iin: dealRows[0].iin,
        },
        ...extraClients,
      ];
    }

    return allClients;
  } catch (error) {
    console.error('getDealClients error:', error);
    return [];
  }
}

// Добавить дополнительного клиента к сделке
export async function addDealClient(dealId: string, leadId: string, isPrimary: boolean = false) {
  try {
    // Проверяем, не добавлен ли уже
    const existing: any[] = await prisma.$queryRaw`
      SELECT id FROM "DealClient" 
      WHERE "dealId" = ${dealId} AND "leadId" = ${leadId} 
      LIMIT 1
    `;

    if (existing.length > 0) {
      return { success: false, error: 'ALREADY_EXISTS', message: 'Клиент уже добавлен в сделку' };
    }

    // Если добавляем основного клиента, снимаем флаг с других и обновляем Deal.leadId
    if (isPrimary) {
      // Сначала сохраняем текущего основного (из Deal.leadId) в DealClient как не-основного,
      // если его там ещё нет — чтобы он не пропал из списка участников
      const currentDeal: any[] = await prisma.$queryRaw`
        SELECT "leadId" FROM "Deal" WHERE "id" = ${dealId} LIMIT 1
      `;
      const oldLeadId = currentDeal[0]?.leadId;
      if (oldLeadId && oldLeadId !== leadId) {
        const oldInDealClient: any[] = await prisma.$queryRaw`
          SELECT id FROM "DealClient" WHERE "dealId" = ${dealId} AND "leadId" = ${oldLeadId} LIMIT 1
        `;
        if (oldInDealClient.length === 0) {
          // Добавляем старого основного как не-основного участника
          await prisma.$executeRaw`
            INSERT INTO "DealClient" ("id", "dealId", "leadId", "isPrimary", "createdAt", "updatedAt")
            VALUES (${crypto.randomUUID()}, ${dealId}, ${oldLeadId}, false, NOW(), NOW())
          `;
        }
      }

      await prisma.$executeRaw`
        UPDATE "DealClient" SET "isPrimary" = false WHERE "dealId" = ${dealId}
      `;
      // Обновляем основного клиента в самой сделке
      await prisma.$executeRaw`
        UPDATE "Deal" SET "leadId" = ${leadId}, "updatedAt" = NOW() WHERE "id" = ${dealId}
      `;
    }

    const id = crypto.randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "DealClient" ("id", "dealId", "leadId", "isPrimary", "createdAt", "updatedAt")
      VALUES (${id}, ${dealId}, ${leadId}, ${isPrimary}, NOW(), NOW())
    `;

    // Если добавляем как основного — пишем лог в ChangeLog
    if (isPrimary) {
      await prisma.$executeRaw`
        INSERT INTO "ChangeLog" ("id", "leadId", "managerId", "field", "oldValue", "newValue", "createdAt")
        VALUES (
          ${crypto.randomUUID()},
          ${leadId},
          ${'system'},
          'PRIMARY_CLIENT_SET',
          null,
          ${`Клиент назначен основным в сделке ${dealId}`},
          NOW()
        )
      `;
    }

    revalidatePath('/deals');
    revalidatePath('/clients');
    return { success: true, clientId: id };
  } catch (error) {
    console.error('addDealClient error:', error);
    return { success: false, error: 'SERVER_ERROR' };
  }
}

// Удалить дополнительного клиента из сделки
export async function removeDealClient(dealClientId: string) {
  try {
    await prisma.$executeRaw`
      DELETE FROM "DealClient" WHERE "id" = ${dealClientId}
    `;
    revalidatePath('/deals');
    revalidatePath('/clients');
    return { success: true };
  } catch (error) {
    console.error('removeDealClient error:', error);
    return { success: false };
  }
}

// Сменить основного клиента
// Сменить основного клиента (обновляет и Deal.leadId, и флаг в DealClient)
export async function setPrimaryClient(dealId: string, newLeadId: string) {
  try {
    // 0. Сохраняем текущего основного в DealClient если его там нет
    const currentDeal: any[] = await prisma.$queryRaw`
      SELECT "leadId" FROM "Deal" WHERE "id" = ${dealId} LIMIT 1
    `;
    const oldLeadId = currentDeal[0]?.leadId;
    if (oldLeadId && oldLeadId !== newLeadId) {
      const oldInDealClient: any[] = await prisma.$queryRaw`
        SELECT id FROM "DealClient" WHERE "dealId" = ${dealId} AND "leadId" = ${oldLeadId} LIMIT 1
      `;
      if (oldInDealClient.length === 0) {
        await prisma.$executeRaw`
          INSERT INTO "DealClient" ("id", "dealId", "leadId", "isPrimary", "createdAt", "updatedAt")
          VALUES (${crypto.randomUUID()}, ${dealId}, ${oldLeadId}, false, NOW(), NOW())
        `;
      }
    }

    // 1. Снимаем флаг isPrimary со всех клиентов этой сделки
    await prisma.$executeRaw`
      UPDATE "DealClient" SET "isPrimary" = false WHERE "dealId" = ${dealId}
    `;

    // 2. Ставим флаг isPrimary = true на выбранном клиенте
    await prisma.$executeRaw`
      UPDATE "DealClient" SET "isPrimary" = true 
      WHERE "dealId" = ${dealId} AND "leadId" = ${newLeadId}
    `;

    // 3. ОБНОВЛЯЕМ основную сделку – меняем leadId
    await prisma.$executeRaw`
      UPDATE "Deal" 
      SET "leadId" = ${newLeadId}, "updatedAt" = NOW()
      WHERE "id" = ${dealId}
    `;

    // 4. Пишем лог в ChangeLog о смене основного клиента
    await prisma.$executeRaw`
      INSERT INTO "ChangeLog" ("id", "leadId", "managerId", "field", "oldValue", "newValue", "createdAt")
      VALUES (
        ${crypto.randomUUID()},
        ${newLeadId},
        ${'system'},
        'PRIMARY_CLIENT_CHANGED',
        null,
        ${`Клиент назначен основным (заменил предыдущего) в сделке ${dealId}`},
        NOW()
      )
    `;

    revalidatePath('/deals');
    revalidatePath('/clients');
    return { success: true };
  } catch (error) {
    console.error('setPrimaryClient error:', error);
    return { success: false };
  }
}

// ========== ФУНКЦИИ ДЛЯ МНОЖЕСТВЕННЫХ ОБЪЕКТОВ ==========

// Получить все дополнительные объекты сделки
export async function getDealUnits(dealId: string) {
  try {
    const units: any[] = await prisma.$queryRaw`
      SELECT du.*, u.number, u.floor, u.rooms, u.type, u.area, u.price, p.name as "projectName"
      FROM "DealUnit" du
      JOIN "Unit" u ON du."unitId" = u.id
      JOIN "Block" b ON u."blockId" = b.id
      JOIN "Project" p ON b."projectId" = p.id
      WHERE du."dealId" = ${dealId} AND du."isDeleted" = false
    `;
    return units;
  } catch (error) {
    console.error('getDealUnits error:', error);
    return [];
  }
}

// Добавить дополнительный объект к сделке
export async function addDealUnit(dealId: string, unitId: string) {
  try {
    const existing: any[] = await prisma.$queryRaw`
      SELECT id FROM "DealUnit" 
      WHERE "dealId" = ${dealId} AND "unitId" = ${unitId} AND "isDeleted" = false
      LIMIT 1
    `;

    if (existing.length > 0) {
      return { success: false, error: 'ALREADY_EXISTS', message: 'Объект уже добавлен в сделку' };
    }

    const id = crypto.randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "DealUnit" ("id", "dealId", "unitId", "isDeleted", "createdAt", "updatedAt")
      VALUES (${id}, ${dealId}, ${unitId}, false, NOW(), NOW())
    `;

    revalidatePath('/deals');
    revalidatePath('/clients');
    return { success: true, unitId: id };
  } catch (error) {
    console.error('addDealUnit error:', error);
    return { success: false };
  }
}

// Причины удаления объекта (для отображения в модалке)


// Удалить объект из сделки (с причиной)
export async function removeDealUnit(dealUnitId: string, deleteReason: string, customReason?: string) {
  try {
    const finalReason = deleteReason === 'Другое' ? customReason : deleteReason;

    await prisma.$executeRaw`
      UPDATE "DealUnit"
      SET "isDeleted" = true, "deleteReason" = ${finalReason}, "deletedAt" = NOW(), "updatedAt" = NOW()
      WHERE "id" = ${dealUnitId}
    `;

    revalidatePath('/deals');
    revalidatePath('/clients');
    return { success: true };
  } catch (error) {
    console.error('removeDealUnit error:', error);
    return { success: false };
  }
}

// Поиск лидов для добавления в сделку
export async function searchLeads(organizationId: string, query: string) {
  try {
    const leads: any[] = await prisma.$queryRaw`
      SELECT id, name, phone, email
      FROM "Lead"
      WHERE "organizationId" = ${organizationId}
        AND (name ILIKE ${`%${query}%`} OR phone ILIKE ${`%${query}%`} OR email ILIKE ${`%${query}%`})
      LIMIT 10
    `;
    return leads;
  } catch (error) {
    console.error('searchLeads error:', error);
    return [];
  }
}

// Поиск объектов для добавления в сделку
export async function searchUnits(organizationId: string, query: string) {
  try {
    const units: any[] = await prisma.$queryRaw`
      SELECT u.id, u.number, u.price, u.area, u.rooms, p.name as "projectName"
      FROM "Unit" u
      JOIN "Block" b ON u."blockId" = b.id
      JOIN "Project" p ON b."projectId" = p.id
      WHERE p."organizationId" = ${organizationId}
        AND (u.number::text ILIKE ${`%${query}%`} OR p.name ILIKE ${`%${query}%`})
      LIMIT 10
    `;
    return units;
  } catch (error) {
    console.error('searchUnits error:', error);
    return [];
  }
}