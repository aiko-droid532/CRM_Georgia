'use server';

import { db as prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

// Получить все проекты организации
export async function getProjects(organizationId: string) {
  const projects: any[] = await prisma.$queryRaw`
    SELECT 
      p.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', b.id,
            'number', b.number,
            'projectId', b."projectId",
            'organizationId', b."organizationId",
            'units', (
              SELECT COALESCE(
                json_agg(
                  json_build_object(
                    'id', u.id,
                    'number', u.number,
                    'floor', u.floor,
                    'area', u.area,
                    'price', u.price,
                    'status', u.status,
                    'blockId', u."blockId",
                    'organizationId', u."organizationId",
                    'rooms', u.rooms,
                    'type', u.type,
                    'livingArea', u."livingArea",
                    'viewType', u."viewType",
                    'version', u.version,
                    'isVip', u."isVip",
                    'thinkingFlag', u."thinkingFlag",
                    'bookingExpiresAt', (
                      SELECT bk."expiresAt" 
                      FROM "Booking" bk 
                      WHERE bk."unitId" = u.id AND bk.status = 'ACTIVE' 
                      LIMIT 1
                    )
                  ) ORDER BY u.floor DESC, u.number ASC
                ),
                '[]'::json
              )
              FROM "Unit" u WHERE u."blockId" = b.id
            )
          ) ORDER BY b.number ASC
        ) FILTER (WHERE b.id IS NOT NULL), '[]'::json
      ) as blocks
    FROM "Project" p
    LEFT JOIN "Block" b ON b."projectId" = p.id
    WHERE p."organizationId" = ${organizationId}
    GROUP BY p.id
  `;
  return projects;
}

// Создать тестовый жилой комплекс для проверки
export async function createDemoProject(organizationId: string) {
  try {
    const projects: any[] = await prisma.$queryRaw`
      INSERT INTO "Project" ("id", "name", "address", "organizationId", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), 'ЖК "Астана Тауэр"', 'пр. Мангилик Ел, 25', ${organizationId}, NOW(), NOW())
      RETURNING id
    `;
    const projectId = projects[0].id;

    const blocks: any[] = await prisma.$queryRaw`
      INSERT INTO "Block" ("id", "number", "projectId", "organizationId", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), 'Блок А', ${projectId}, ${organizationId}, NOW(), NOW())
      RETURNING id
    `;
    const blockId = blocks[0].id;

    // 3 этажа по 4 квартиры
    const units = [
      { number: '101', floor: 1, area: 45.5, price: 18000000, status: 'FREE' },
      { number: '102', floor: 1, area: 65.2, price: 25000000, status: 'RESERVATION_PAID' },
      { number: '103', floor: 1, area: 45.5, price: 18000000, status: 'FREE' },
      { number: '104', floor: 1, area: 85.0, price: 35000000, status: 'SOLD' },
      
      { number: '201', floor: 2, area: 45.5, price: 18500000, status: 'FREE' },
      { number: '202', floor: 2, area: 65.2, price: 25500000, status: 'FREE' },
      { number: '203', floor: 2, area: 45.5, price: 18500000, status: 'RESERVATION_ORAL' },
      { number: '204', floor: 2, area: 85.0, price: 35500000, status: 'FREE' },
      
      { number: '301', floor: 3, area: 45.5, price: 19000000, status: 'SOLD' },
      { number: '302', floor: 3, area: 65.2, price: 26000000, status: 'FREE' },
      { number: '303', floor: 3, area: 45.5, price: 19000000, status: 'FREE' },
      { number: '304', floor: 3, area: 85.0, price: 36000000, status: 'FREE' }
    ];

    for (const unit of units) {
      await prisma.$executeRaw`
        INSERT INTO "Unit" ("id", "number", "floor", "area", "price", "status", "blockId", "organizationId", "createdAt", "updatedAt", "rooms", "type")
        VALUES (gen_random_uuid(), ${unit.number}, ${unit.floor}, ${unit.area}, ${unit.price}, ${unit.status}, ${blockId}, ${organizationId}, NOW(), NOW(), 1, 'Apartment')
      `;
    }

    revalidatePath('/shakhmatka');
    return { success: true, project: { id: projectId } };
  } catch (error) {
    console.error('Seed error:', error);
    return { success: false, error: 'Failed to create demo project' };
  }
}

// Массовое изменение цен на квартиры (CAT-007)
export async function massUpdatePrices(data: {
  projectId: string;
  blockId?: string;
  rooms?: string;
  changeType: 'PERCENT' | 'FIXED';
  changeValue: number;
  reason: string;
  organizationId: string;
  initiatorId: string;
}) {
  try {
    const { projectId, blockId, rooms, changeType, changeValue, reason, organizationId, initiatorId } = data;

    // 1. Получаем список квартир, соответствующих фильтрам
    let selectQuery = `
      SELECT u.id, u.price 
      FROM "Unit" u
      JOIN "Block" b ON u."blockId" = b.id
      WHERE b."projectId" = $1 AND u."organizationId" = $2 AND u."status" != 'SOLD'::"UnitStatus"
    `;
    const params: any[] = [projectId, organizationId];

    if (blockId) {
      params.push(blockId);
      selectQuery += ` AND u."blockId" = $${params.length}`;
    }
    if (rooms && rooms !== 'ALL') {
      params.push(parseInt(rooms));
      selectQuery += ` AND u."rooms" = $${params.length}`;
    }

    const { pool } = require('@/lib/db');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const res = await client.query(selectQuery, params);
      const units = res.rows;

      if (units.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, message: 'Не найдено подходящих квартир для обновления' };
      }

      // 2. Для каждой квартиры обновляем цену и вносим запись в PriceHistory
      for (const unit of units) {
        const oldPrice = unit.price;
        let newPrice = oldPrice;

        if (changeType === 'PERCENT') {
          newPrice = Math.round(oldPrice * (1 + changeValue / 100));
        } else {
          newPrice = oldPrice + changeValue;
        }

        if (newPrice < 0) newPrice = 0;

        // Обновляем Unit
        await client.query(
          `UPDATE "Unit" SET "price" = $1, "updatedAt" = NOW(), "version" = "version" + 1 WHERE "id" = $2`,
          [newPrice, unit.id]
        );

        // Пишем лог
        const historyId = crypto.randomUUID();
        await client.query(
          `INSERT INTO "PriceHistory" ("id", "unitId", "oldPrice", "newPrice", "currency", "initiatorId", "reason", "organizationId", "createdAt")
           VALUES ($1, $2, $3, $4, 'USD', $5, $6, $7, NOW())`,
          [historyId, unit.id, oldPrice, newPrice, initiatorId, reason, organizationId]
        );
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    revalidatePath('/shakhmatka');
    return { success: true, count: data.changeValue };
  } catch (error) {
    console.error('Mass price update error:', error);
    return { success: false, error: 'SERVER_ERROR', message: 'Ошибка при массовом обновлении цен в БД' };
  }
}

// Получить историю цен для квартиры (CAT-006)
export async function getPriceHistory(unitId: string) {
  try {
    const history: any[] = await prisma.$queryRaw`
      SELECT ph.*, m.name as "initiatorName"
      FROM "PriceHistory" ph
      LEFT JOIN "Manager" m ON ph."initiatorId" = m.id
      WHERE ph."unitId" = ${unitId}
      ORDER BY ph."createdAt" DESC
    `;
    return history;
  } catch (error) {
    console.error('getPriceHistory error:', error);
    return [];
  }
}

// ========== CAT-004: CRUD для Помещения ==========

// Создание новой квартиры
export async function createUnit(data: {
  number: string;
  floor: number;
  area: number;
  rooms: number;
  price: number;
  type: string;
  viewType?: string;
  livingArea?: number;
  blockId: string;
  organizationId: string;
  createdById: string;
}) {
  try {
    // Проверяем, не существует ли уже квартира с таким номером
    const existing = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Unit" 
      WHERE number = ${data.number} AND "blockId" = ${data.blockId}
      LIMIT 1
    `;
    
    if (existing.length > 0) {
      return { success: false, error: 'Квартира с таким номером уже существует в этом корпусе' };
    }
    
    const unitId = crypto.randomUUID();
    
    await prisma.$executeRaw`
      INSERT INTO "Unit" (
        id, number, floor, area, rooms, price, status, type, "viewType", "livingArea",
        "blockId", "organizationId", "createdAt", "updatedAt", version
      )
      VALUES (
        ${unitId}, ${data.number}, ${data.floor}, ${data.area}, ${data.rooms}, ${data.price},
        'FREE', ${data.type}, ${data.viewType || null}, ${data.livingArea || null},
        ${data.blockId}, ${data.organizationId}, NOW(), NOW(), 1
      )
    `;
    
    revalidatePath('/shakhmatka');
    return { success: true, unit: { id: unitId } };
  } catch (error) {
    console.error('Create unit error:', error);
    return { success: false, error: 'Ошибка при создании квартиры' };
  }
}

// Обновление квартиры (все поля)
export async function updateUnit(data: {
  unitId: string;
  number?: string;
  floor?: number;
  area?: number;
  rooms?: number;
  price?: number;
  type?: string;
  viewType?: string;
  livingArea?: number;
  status?: string;
  reason: string;
  organizationId: string;
  initiatorId: string;
}) {
  try {
    // Получаем старые данные
    const oldUnit = await prisma.$queryRaw<{
      number: string; floor: number; area: number; rooms: number;
      price: number; type: string; viewType: string; livingArea: number; status: string;
    }[]>`
      SELECT number, floor, area, rooms, price, type, "viewType", "livingArea", status
      FROM "Unit" WHERE id = ${data.unitId} LIMIT 1
    `;
    
    if (oldUnit.length === 0) {
      return { success: false, error: 'Квартира не найдена' };
    }
    
    const old = oldUnit[0];
    const updates: string[] = [];
    const changes: string[] = [];
    
    // Собираем изменения
    if (data.number !== undefined && data.number !== old.number) {
      updates.push(Prisma.sql`"number" = ${data.number}`);
      changes.push(`номер: ${old.number} → ${data.number}`);
    }
    if (data.floor !== undefined && data.floor !== old.floor) {
      updates.push(Prisma.sql`"floor" = ${data.floor}`);
      changes.push(`этаж: ${old.floor} → ${data.floor}`);
    }
    if (data.area !== undefined && data.area !== old.area) {
      updates.push(Prisma.sql`"area" = ${data.area}`);
      changes.push(`площадь: ${old.area}м² → ${data.area}м²`);
    }
    if (data.rooms !== undefined && data.rooms !== old.rooms) {
      updates.push(Prisma.sql`"rooms" = ${data.rooms}`);
      changes.push(`комнат: ${old.rooms} → ${data.rooms}`);
    }
    if (data.price !== undefined && data.price !== old.price) {
      updates.push(Prisma.sql`"price" = ${data.price}`);
      changes.push(`цена: $${old.price.toLocaleString()} → $${data.price.toLocaleString()}`);
      
      // Записываем в историю цен
      await prisma.$executeRaw`
        INSERT INTO "PriceHistory" (
          id, "unitId", "oldPrice", "newPrice", currency, 
          "initiatorId", reason, "organizationId", "createdAt"
        )
        VALUES (
          ${crypto.randomUUID()}, ${data.unitId}, ${old.price}, ${data.price}, 'USD',
          ${data.initiatorId}, ${data.reason}, ${data.organizationId}, NOW()
        )
      `;
    }
    if (data.type !== undefined && data.type !== old.type) {
      updates.push(Prisma.sql`"type" = ${data.type}`);
      changes.push(`тип: ${old.type} → ${data.type}`);
    }
    if (data.viewType !== undefined && data.viewType !== old.viewType) {
      updates.push(Prisma.sql`"viewType" = ${data.viewType}`);
      changes.push(`вид: ${old.viewType || '—'} → ${data.viewType}`);
    }
    if (data.livingArea !== undefined && data.livingArea !== old.livingArea) {
      updates.push(Prisma.sql`"livingArea" = ${data.livingArea}`);
      changes.push(`жилая площадь: ${old.livingArea || '—'}м² → ${data.livingArea}м²`);
    }
    if (data.status !== undefined && data.status !== old.status) {
      updates.push(Prisma.sql`"status" = ${data.status}::"UnitStatus"`);
      changes.push(`статус: ${old.status} → ${data.status}`);
    }
    
    if (updates.length === 0) {
      return { success: true, message: 'Нет изменений' };
    }
    
    updates.push(Prisma.sql`"version" = "version" + 1`);
    updates.push(Prisma.sql`"updatedAt" = NOW()`);
    
    await prisma.$executeRaw`
      UPDATE "Unit" 
      SET ${Prisma.join(updates, ', ')}
      WHERE id = ${data.unitId}
    `;
    
    // Логируем изменения
    if (changes.length > 0) {
      await prisma.$executeRaw`
        INSERT INTO "ChangeLog" (
          id, "leadId", "managerId", field, "oldValue", "newValue", "createdAt"
        )
        VALUES (
          ${crypto.randomUUID()}, NULL, ${data.initiatorId}, 'UNIT_UPDATE',
          ${JSON.stringify({ changes })}, ${data.reason}, NOW()
        )
      `;
    }
    
    revalidatePath('/shakhmatka');
    return { success: true, changes };
  } catch (error) {
    console.error('Update unit error:', error);
    return { success: false, error: 'Ошибка при обновлении квартиры' };
  }
}

// Мягкое удаление квартиры (статус EXCLUDED)
// Удаление квартиры (мягкое) - ИСПРАВЛЕННАЯ ВЕРСИЯ
// Удаление квартиры (мягкое) - ИСПРАВЛЕННАЯ ВЕРСИЯ
export async function deleteUnit(unitId: string, reason: string, organizationId: string, initiatorId: string) {
  try {
    // Проверяем, есть ли активные сделки по этой квартире
    const activeDeals = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Deal" 
      WHERE "unitId" = ${unitId} 
      AND status NOT IN ('SUCCESS', 'CANCELLED', 'FAILED')
      LIMIT 1
    `;
    
    if (activeDeals.length > 0) {
      return { success: false, error: 'Невозможно удалить квартиру с активными сделками' };
    }
    
    // Меняем статус на EXCLUDED (мягкое удаление)
    await prisma.$executeRaw`
      UPDATE "Unit" 
      SET status = 'EXCLUDED'::"UnitStatus", "updatedAt" = NOW(), version = version + 1
      WHERE id = ${unitId}
    `;
    
    // 👇 ИСПРАВЛЕННЫЙ INSERT — убираем leadId, так как это не связано с лидом
    await prisma.$executeRaw`
      INSERT INTO "ChangeLog" (
        id, "managerId", field, "oldValue", "newValue", "createdAt"
      )
      VALUES (
        ${crypto.randomUUID()}, ${initiatorId}, 'UNIT_DELETED',
        ${unitId}, ${reason}, NOW()
      )
    `;
    
    revalidatePath('/shakhmatka');
    return { success: true };
  } catch (error) {
    console.error('Delete unit error:', error);
    return { success: false, error: 'Ошибка при удалении квартиры: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка') };
  }
}


// Получить все блоки для выбора при создании
export async function getBlocksForSelect(organizationId: string) {
  try {
    const blocks = await prisma.$queryRaw<{ id: string; number: string; projectName: string }[]>`
      SELECT b.id, b.number, p.name as "projectName"
      FROM "Block" b
      JOIN "Project" p ON b."projectId" = p.id
      WHERE b."organizationId" = ${organizationId}
      ORDER BY p.name, b.number
    `;
    return blocks;
  } catch (error) {
    console.error('Get blocks error:', error);
    return [];
  }
}

