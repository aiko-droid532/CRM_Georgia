'use server';

import { db as prisma } from '@/lib/db';

// Цены хранятся напрямую в USD, конвертация не требуется
function convertPrice(price: number, projectName?: string): number {
  return price;
}

// RPT-001: Воронка продаж (количество сделок, суммы и конверсия по этапам)
export async function getFunnelReportData(organizationId: string) {
  try {
    const rawData: any[] = await prisma.$queryRaw`
      SELECT 
        d.id as "dealId",
        d.status::text as "stage",
        b."projectId" as "projectId",
        p."nameRu" as "projectName",
        d."createdAt" as "createdAt",
        COALESCE(u.price, 0)::double precision as "amount",
        COALESCE(d."managerId", 'Не назначен') as "managerId",
        COALESCE(l.source, 'Не указан') as "source",
        l."isVip" as "isVip",
        COALESCE(d."paymentType", 'Не указана') as "paymentType"
      FROM "Deal" d
      JOIN "Lead" l ON d."leadId" = l.id
      LEFT JOIN "Unit" u ON d."unitId" = u.id
      LEFT JOIN "Block" b ON u."blockId" = b.id
      LEFT JOIN "Project" p ON b."projectId" = p.id
      WHERE d."organizationId" = ${organizationId}
    `;
    
    return rawData.map(row => ({
      dealId: row.dealId,
      stage: row.stage,
      projectId: row.projectId,
      createdAt: row.createdAt ? row.createdAt.toISOString().split('T')[0] : null,
      amount: convertPrice(row.amount, row.projectName),
      managerId: row.managerId,
      source: row.source,
      isVip: row.isVip,
      paymentType: row.paymentType
    }));
  } catch (e) {
    console.error('getFunnelReportData error:', e);
    return [];
  }
}

// RPT-001: Исторические переходы (Conversion View) из AuditLog
export async function getDealTransitions(organizationId: string) {
  try {
    const rawData: any[] = await prisma.$queryRaw`
      SELECT 
        a."entityId" as "dealId",
        a."oldValue" as "fromStage",
        a."newValue" as "toStage",
        a."createdAt" as "createdAt",
        b."projectId" as "projectId",
        p."nameRu" as "projectName",
        COALESCE(d."managerId", 'Не назначен') as "managerId",
        COALESCE(l.source, 'Не указан') as "source",
        l."isVip" as "isVip",
        COALESCE(d."paymentType", 'Не указана') as "paymentType",
        COALESCE(u.price, 0)::double precision as "amount"
      FROM "AuditLog" a
      JOIN "Deal" d ON a."entityId" = d.id
      JOIN "Lead" l ON d."leadId" = l.id
      LEFT JOIN "Unit" u ON d."unitId" = u.id
      LEFT JOIN "Block" b ON u."blockId" = b.id
      LEFT JOIN "Project" p ON b."projectId" = p.id
      WHERE a."entityType" = 'Deal' 
        AND a."fieldName" = 'status' 
        AND a."organizationId" = ${organizationId}
    `;
    return rawData.map(row => ({
      dealId: row.dealId,
      fromStage: row.fromStage,
      toStage: row.toStage,
      createdAt: row.createdAt ? row.createdAt.toISOString().split('T')[0] : null,
      projectId: row.projectId,
      managerId: row.managerId,
      source: row.source,
      isVip: row.isVip,
      paymentType: row.paymentType,
      amount: convertPrice(row.amount, row.projectName)
    }));
  } catch (e) {
    console.error('getDealTransitions error:', e);
    return [];
  }
}

// RPT-002: План/факт продаж по ЖК (SUCCESS/PAYMENT_CONFIRMED сделки по проектам + юниты со статусом SOLD/DOWN_PAYMENT_RECEIVED)
export async function getProjectSalesReportData(organizationId: string) {
  try {
    const rawData: any[] = await prisma.$queryRaw`
      SELECT 
        d.id as "dealId",
        p.id as "projectId",
        p."nameRu" as "projectName",
        COALESCE(d."updatedAt", u."updatedAt") as "wonAt",
        COALESCE(u.price, 0)::double precision as "price",
        b.id as "blockId",
        u.type as "unitType",
        COALESCE(st."targetUnits", 0)::int as "targetUnits",
        COALESCE(st."targetRevenue", 0.0)::double precision as "targetRevenue"
      FROM "Unit" u
      JOIN "Block" b ON u."blockId" = b.id
      JOIN "Project" p ON b."projectId" = p.id
      LEFT JOIN "Deal" d ON d."unitId" = u.id AND d.status IN ('SUCCESS', 'PAYMENT_CONFIRMED')
      LEFT JOIN "SalesTarget" st ON st."projectId" = p.id AND st."targetType" = 'PROJECT'
      WHERE p."organizationId" = ${organizationId}
        AND (u.status IN ('SOLD', 'DOWN_PAYMENT_RECEIVED') OR d.status IN ('SUCCESS', 'PAYMENT_CONFIRMED'))
    `;

    return rawData.map(row => {
      const price = convertPrice(row.price, row.projectName);
      return {
        dealId: row.dealId,
        projectId: row.projectId,
        projectName: row.projectName,
        wonAt: row.wonAt ? row.wonAt.toISOString().split('T')[0] : null,
        price,
        blockId: row.blockId,
        unitType: row.unitType,
        targetUnits: row.targetUnits,
        targetRevenue: row.targetRevenue
      };
    });
  } catch (e) {
    console.error('getProjectSalesReportData error:', e);
    return [];
  }
}

// RPT-003: План/факт продаж по менеджерам (SUCCESS/PAYMENT_CONFIRMED сделки + юниты SOLD/DOWN_PAYMENT_RECEIVED)
export async function getManagerSalesReportData(organizationId: string) {
  try {
    const rawData: any[] = await prisma.$queryRaw`
      SELECT 
        d.id as "dealId",
        COALESCE(d."managerId", 'Не назначен') as "managerId",
        p.id as "projectId",
        p."nameRu" as "projectName",
        COALESCE(d."updatedAt", u."updatedAt") as "wonAt",
        COALESCE(u.price, 0)::double precision as "price",
        COALESCE(st."targetUnits", 0)::int as "targetUnits",
        COALESCE(st."targetRevenue", 0.0)::double precision as "targetRevenue"
      FROM "Unit" u
      JOIN "Block" b ON u."blockId" = b.id
      JOIN "Project" p ON b."projectId" = p.id
      LEFT JOIN "Deal" d ON d."unitId" = u.id AND d.status IN ('SUCCESS', 'PAYMENT_CONFIRMED')
      LEFT JOIN "SalesTarget" st ON st."managerId" = d."managerId" AND st."targetType" = 'MANAGER'
      WHERE p."organizationId" = ${organizationId}
        AND (u.status IN ('SOLD', 'DOWN_PAYMENT_RECEIVED') OR d.status IN ('SUCCESS', 'PAYMENT_CONFIRMED'))
    `;

    return rawData.map(row => {
      const price = convertPrice(row.price, row.projectName);
      return {
        dealId: row.dealId,
        managerId: row.managerId,
        projectId: row.projectId,
        wonAt: row.wonAt ? row.wonAt.toISOString().split('T')[0] : null,
        price,
        targetUnits: row.targetUnits,
        targetRevenue: row.targetRevenue
      };
    });
  } catch (e) {
    console.error('getManagerSalesReportData error:', e);
    return [];
  }
}

// RPT-004: Сводный отчет по продажам (Денежный поток от проданных квартир)
export async function getSalesCashFlowData(organizationId: string) {
  try {
    const rawData: any[] = await prisma.$queryRaw`
      SELECT 
        d.id as "dealId",
        l.name as "clientName",
        u.number as "unitNumber",
        u.price as "contractAmount",
        b."projectId" as "projectId",
        p."nameRu" as "projectName",
        d."createdAt" as "createdAt",
        COALESCE(d."paymentType", 'Не указана') as "paymentType",
        COALESCE(d."managerId", 'Не назначен') as "managerId",
        COALESCE((
          SELECT SUM(t.amount) 
          FROM "Transaction" t 
          JOIN "PaymentSchedule" ps ON t."paymentScheduleId" = ps.id
          WHERE ps."dealId" = d.id
        ), 0)::double precision as "paidAmount",
        COALESCE((
          SELECT SUM(ps.amount) 
          FROM "PaymentSchedule" ps 
          WHERE ps."dealId" = d.id AND ps.status IN ('PENDING', 'OVERDUE')
        ), 0)::double precision as "pendingAmount"
      FROM "Deal" d
      JOIN "Lead" l ON d."leadId" = l.id
      JOIN "Unit" u ON d."unitId" = u.id
      JOIN "Block" b ON u."blockId" = b.id
      JOIN "Project" p ON b."projectId" = p.id
      WHERE d."organizationId" = ${organizationId} 
        AND d.status NOT IN ('FAILED', 'CANCELLED')
    `;

    return rawData.map(row => ({
      dealId: row.dealId,
      clientName: row.clientName,
      unitNumber: row.unitNumber,
      contractAmount: convertPrice(row.contractAmount, row.projectName),
      projectId: row.projectId,
      createdAt: row.createdAt ? row.createdAt.toISOString().split('T')[0] : null,
      paymentType: row.paymentType,
      managerId: row.managerId,
      paidAmount: convertPrice(row.paidAmount, row.projectName),
      pendingAmount: convertPrice(row.pendingAmount, row.projectName)
    }));
  } catch (e) {
    console.error('getSalesCashFlowData error:', e);
    return [];
  }
}

// RPT-008: Реестр платежей (плановые и фактические оплаты за период)
export async function getPaymentRegistryData(organizationId: string) {
  try {
    const rawData: any[] = await prisma.$queryRaw`
      SELECT 
        ps.id as "scheduleId",
        d.id as "dealId",
        l.name as "clientName",
        u.number as "unitNumber",
        ps.amount as "scheduledAmount",
        ps."dueDate" as "dueDate",
        ps.status::text as "paymentStatus",
        b."projectId" as "projectId",
        p."nameRu" as "projectName",
        COALESCE((
          SELECT SUM(t.amount) 
          FROM "Transaction" t 
          WHERE t."paymentScheduleId" = ps.id
        ), 0)::double precision as "paidAmount"
      FROM "PaymentSchedule" ps
      JOIN "Deal" d ON ps."dealId" = d.id
      JOIN "Lead" l ON d."leadId" = l.id
      JOIN "Unit" u ON d."unitId" = u.id
      JOIN "Block" b ON u."blockId" = b.id
      JOIN "Project" p ON b."projectId" = p.id
      WHERE ps."organizationId" = ${organizationId}
      ORDER BY ps."dueDate" ASC
    `;

    return rawData.map(row => ({
      scheduleId: row.scheduleId,
      dealId: row.dealId,
      clientName: row.clientName,
      unitNumber: row.unitNumber,
      scheduledAmount: convertPrice(row.scheduledAmount, row.projectName),
      dueDate: row.dueDate.toISOString().split('T')[0],
      paymentStatus: row.paymentStatus,
      projectId: row.projectId,
      paidAmount: convertPrice(row.paidAmount, row.projectName)
    }));
  } catch (e) {
    console.error('getPaymentRegistryData error:', e);
    return [];
  }
}

// RPT-009: Реестр дебиторской задолженности (просроченные платежи)
export async function getDebtorsRegistryData(organizationId: string) {
  try {
    const rawData: any[] = await prisma.$queryRaw`
      SELECT 
        ps.id as "scheduleId",
        d.id as "dealId",
        l.name as "clientName",
        l.phone as "clientPhone",
        u.number as "unitNumber",
        ps.amount as "overdueAmount",
        ps."dueDate" as "dueDate",
        b."projectId" as "projectId",
        p."nameRu" as "projectName",
        COALESCE(d."managerId", 'Не назначен') as "managerId",
        COALESCE(d."penaltyRate", 0.001) as "penaltyRate"
      FROM "PaymentSchedule" ps
      JOIN "Deal" d ON ps."dealId" = d.id
      JOIN "Lead" l ON d."leadId" = l.id
      JOIN "Unit" u ON d."unitId" = u.id
      JOIN "Block" b ON u."blockId" = b.id
      JOIN "Project" p ON b."projectId" = p.id
      WHERE ps."organizationId" = ${organizationId} 
        AND (ps.status = 'OVERDUE' OR (ps.status = 'PENDING' AND ps."dueDate" < NOW()))
      ORDER BY ps."dueDate" ASC
    `;

    return rawData.map(row => {
      const overdueAmount = convertPrice(row.overdueAmount, row.projectName);
      const daysOverdue = Math.max(0, Math.floor((Date.now() - new Date(row.dueDate).getTime()) / (1000 * 60 * 60 * 24)));
      const rate = row.penaltyRate ?? 0.001;
      const penalty = parseFloat((overdueAmount * rate * daysOverdue).toFixed(2)); // Пеня по ставке из договора
      return {
        scheduleId: row.scheduleId,
        dealId: row.dealId,
        clientName: row.clientName,
        clientPhone: row.clientPhone,
        unitNumber: row.unitNumber,
        overdueAmount,
        dueDate: row.dueDate.toISOString().split('T')[0],
        projectId: row.projectId,
        managerId: row.managerId,
        daysOverdue,
        penalty,
        totalDebt: overdueAmount + penalty
      };
    });
  } catch (e) {
    console.error('getDebtorsRegistryData error:', e);
    return [];
  }
}

// RPT-023: Эффективность менеджеров (Количество звонков, встреч, сделок и цикл сделки)
export async function getManagerKpiData(organizationId: string) {
  try {
    const rawData: any[] = await prisma.$queryRaw`
      SELECT 
        d.id as "dealId",
        COALESCE(d."managerId", 'Не назначен') as "managerId",
        b."projectId" as "projectId",
        d."createdAt" as "createdAt",
        d.status::text as "status"
      FROM "Deal" d
      LEFT JOIN "Unit" u ON d."unitId" = u.id
      LEFT JOIN "Block" b ON u."blockId" = b.id
      WHERE d."organizationId" = ${organizationId}
    `;

    return rawData.map(row => ({
      dealId: row.dealId,
      managerId: row.managerId,
      projectId: row.projectId,
      createdAt: row.createdAt ? row.createdAt.toISOString().split('T')[0] : null,
      status: row.status
    }));
  } catch (e) {
    console.error('getManagerKpiData error:', e);
    return [];
  }
}

// RPT-024: Эффективность источников рекламы (сделки, конверсии и выручка по каналам)
export async function getMarketingChannelsData(organizationId: string) {
  try {
    const rawData: any[] = await prisma.$queryRaw`
      SELECT 
        d.id as "dealId",
        COALESCE(l.source, 'Не указан') as "source",
        b."projectId" as "projectId",
        p."nameRu" as "projectName",
        d."createdAt" as "createdAt",
        d.status::text as "status",
        COALESCE(u.price, 0)::double precision as "price"
      FROM "Deal" d
      JOIN "Lead" l ON d."leadId" = l.id
      LEFT JOIN "Unit" u ON d."unitId" = u.id
      LEFT JOIN "Block" b ON u."blockId" = b.id
      LEFT JOIN "Project" p ON b."projectId" = p.id
      WHERE d."organizationId" = ${organizationId}
    `;

    return rawData.map(row => ({
      dealId: row.dealId,
      source: row.source,
      projectId: row.projectId,
      createdAt: row.createdAt ? row.createdAt.toISOString().split('T')[0] : null,
      status: row.status,
      price: convertPrice(row.price, row.projectName)
    }));
  } catch (e) {
    console.error('getMarketingChannelsData error:', e);
    return [];
  }
}

// Получить список реальных проектов (ЖК) из базы данных для фильтрации
export async function getProjectsList(organizationId: string) {
  try {
    const rawData: any[] = await prisma.$queryRaw`
      SELECT 
        id,
        "nameRu" as "name"
      FROM "Project"
      WHERE "organizationId" = ${organizationId}
      ORDER BY "nameRu" ASC
    `;
    return rawData.map(row => ({
      id: row.id,
      name: row.name
    }));
  } catch (e) {
    console.error('getProjectsList error:', e);
    return [];
  }
}

// Получить список менеджеров из сделок и лидов
export async function getManagersList(organizationId: string) {
  try {
    const rawData: any[] = await prisma.$queryRaw`
      SELECT DISTINCT "managerId" 
      FROM "Deal" 
      WHERE "organizationId" = ${organizationId} AND "managerId" IS NOT NULL AND "managerId" != ''
      UNION
      SELECT DISTINCT "managerId" 
      FROM "Lead" 
      WHERE "organizationId" = ${organizationId} AND "managerId" IS NOT NULL AND "managerId" != ''
    `;
    return rawData.map(row => row.managerId).filter(Boolean);
  } catch (e) {
    console.error('getManagersList error:', e);
    return [];
  }
}

// Получить список корпусов (Block) для ЖК
export async function getBlocksList(organizationId: string) {
  try {
    const rawData: any[] = await prisma.$queryRaw`
      SELECT id, number, "projectId"
      FROM "Block"
      WHERE "organizationId" = ${organizationId}
      ORDER BY number ASC
    `;
    return rawData;
  } catch (e) {
    console.error('getBlocksList error:', e);
    return [];
  }
}

// Получить список источников из лидов
export async function getSourcesList(organizationId: string) {
  try {
    const rawData: any[] = await prisma.$queryRaw`
      SELECT DISTINCT source 
      FROM "Lead" 
      WHERE "organizationId" = ${organizationId} AND source IS NOT NULL AND source != ''
    `;
    return rawData.map(row => row.source).filter(Boolean);
  } catch (e) {
    console.error('getSourcesList error:', e);
    return [];
  }
}

// Получить список типов оплат (схем оплат) из сделок
export async function getPaymentTypesList(organizationId: string) {
  try {
    const rawData: any[] = await prisma.$queryRaw`
      SELECT DISTINCT "paymentType" 
      FROM "Deal" 
      WHERE "organizationId" = ${organizationId} AND "paymentType" IS NOT NULL AND "paymentType" != ''
    `;
    return rawData.map(row => row.paymentType).filter(Boolean);
  } catch (e) {
    console.error('getPaymentTypesList error:', e);
    return [];
  }
}

// Получить список типов помещений
export async function getUnitTypesList(organizationId: string) {
  try {
    const rawData: any[] = await prisma.$queryRaw`
      SELECT DISTINCT type 
      FROM "Unit" 
      WHERE "organizationId" = ${organizationId} AND type IS NOT NULL AND type != ''
    `;
    return rawData.map(row => row.type).filter(Boolean);
  } catch (e) {
    console.error('getUnitTypesList error:', e);
    return [];
  }
}

// RPT-010: Сводный денежный поток (прогноз по графику платежей vs факт по транзакциям, сгруппировано по месяцам)
export async function getCashFlowReportData(organizationId: string) {
  try {
    // Плановые платежи по месяцам
    const scheduled: any[] = await prisma.$queryRaw`
      SELECT
        TO_CHAR(ps."dueDate", 'YYYY-MM') as "month",
        b."projectId" as "projectId",
        SUM(ps.amount)::double precision as "scheduledAmount",
        COUNT(*)::int as "scheduledCount"
      FROM "PaymentSchedule" ps
      JOIN "Deal" d ON ps."dealId" = d.id
      JOIN "Unit" u ON d."unitId" = u.id
      JOIN "Block" b ON u."blockId" = b.id
      WHERE ps."organizationId" = ${organizationId}
      GROUP BY TO_CHAR(ps."dueDate", 'YYYY-MM'), b."projectId"
      ORDER BY "month" ASC
    `;

    // Фактические оплаты по месяцам
    const actual: any[] = await prisma.$queryRaw`
      SELECT
        TO_CHAR(t.date, 'YYYY-MM') as "month",
        b."projectId" as "projectId",
        SUM(t.amount)::double precision as "paidAmount",
        COUNT(*)::int as "paidCount"
      FROM "Transaction" t
      JOIN "PaymentSchedule" ps ON t."paymentScheduleId" = ps.id
      JOIN "Deal" d ON ps."dealId" = d.id
      JOIN "Unit" u ON d."unitId" = u.id
      JOIN "Block" b ON u."blockId" = b.id
      WHERE t."organizationId" = ${organizationId}
      GROUP BY TO_CHAR(t.date, 'YYYY-MM'), b."projectId"
      ORDER BY "month" ASC
    `;

    // Объединяем по ключу month+projectId
    const map: Record<string, { month: string; projectId: string; scheduledAmount: number; paidAmount: number }> = {};

    scheduled.forEach(row => {
      const key = `${row.month}__${row.projectId}`;
      if (!map[key]) map[key] = { month: row.month, projectId: row.projectId, scheduledAmount: 0, paidAmount: 0 };
      map[key].scheduledAmount += row.scheduledAmount;
    });

    actual.forEach(row => {
      const key = `${row.month}__${row.projectId}`;
      if (!map[key]) map[key] = { month: row.month, projectId: row.projectId, scheduledAmount: 0, paidAmount: 0 };
      map[key].paidAmount += row.paidAmount;
    });

    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  } catch (e) {
    console.error('getCashFlowReportData error:', e);
    return [];
  }
}

// RPT-005: Реестр заявок на договор (ContractDraft)
export async function getContractDraftsReportData(organizationId: string) {
  try {
    const rawData: any[] = await prisma.$queryRaw`
      SELECT 
        d.id as "dealId",
        l.name as "clientName",
        COALESCE(d."managerId", 'Не назначен') as "managerName",
        p."nameRu" as "projectName",
        b."projectId" as "projectId",
        u.number as "unitNumber",
        a_prep."createdAt" as "draftCreatedAt",
        a_signed."createdAt" as "draftApprovedAt",
        d.status::text as "currentDealStatus",
        a_prep."managerId" as "initiator",
        a_signed."managerId" as "approver"
      FROM "AuditLog" a_prep
      JOIN "Deal" d ON a_prep."entityId" = d.id
      JOIN "Lead" l ON d."leadId" = l.id
      JOIN "Unit" u ON d."unitId" = u.id
      JOIN "Block" b ON u."blockId" = b.id
      JOIN "Project" p ON b."projectId" = p.id
      LEFT JOIN "AuditLog" a_signed ON a_signed."entityId" = d.id 
        AND a_signed."entityType" = 'Deal' 
        AND a_signed."fieldName" = 'status' 
        AND a_signed."newValue" = 'CONTRACT'
        AND a_signed."createdAt" > a_prep."createdAt"
      WHERE a_prep."entityType" = 'Deal'
        AND a_prep."fieldName" = 'status'
        AND a_prep."newValue" = 'CONTRACT_PREPARATION'
        AND d."organizationId" = ${organizationId}
    `;

    return rawData.map(row => ({
      dealId: row.dealId,
      clientName: row.clientName,
      managerName: row.managerName,
      projectName: row.projectName,
      projectId: row.projectId,
      unitNumber: row.unitNumber,
      draftCreatedAt: row.draftCreatedAt ? row.draftCreatedAt.toISOString() : null,
      draftApprovedAt: row.draftApprovedAt ? row.draftApprovedAt.toISOString() : null,
      currentDealStatus: row.currentDealStatus,
      initiator: row.initiator,
      approver: row.approver
    }));
  } catch (e) {
    console.error('getContractDraftsReportData error:', e);
    return [];
  }
}

// RPT-006: Динамика продаж (Посещения/встречи отсутствуют в схеме, берем Лиды, Брони, Договоры, Суммы, Оплаты)
export async function getSalesDynamicsReportData(organizationId: string) {
  try {
    // 1. Лиды (уникальные, исключая дублирование из-за джойнов с несколькими сделками)
    const leads: any[] = await prisma.$queryRaw`
      SELECT 
        l.id, 
        l."createdAt" as "createdAt",
        (
          SELECT p.id
          FROM "Deal" d
          JOIN "Unit" u ON d."unitId" = u.id
          JOIN "Block" b ON u."blockId" = b.id
          JOIN "Project" p ON b."projectId" = p.id
          WHERE d."leadId" = l.id
          LIMIT 1
        ) as "projectId",
        (
          SELECT p."nameRu"
          FROM "Deal" d
          JOIN "Unit" u ON d."unitId" = u.id
          JOIN "Block" b ON u."blockId" = b.id
          JOIN "Project" p ON b."projectId" = p.id
          WHERE d."leadId" = l.id
          LIMIT 1
        ) as "projectName"
      FROM "Lead" l
      WHERE l."organizationId" = ${organizationId}
    `;

    // 2. Бронирования
    const bookings: any[] = await prisma.$queryRaw`
      SELECT 
        bk.id, 
        bk."createdAt" as "createdAt",
        p.id as "projectId",
        p."nameRu" as "projectName"
      FROM "Booking" bk
      JOIN "Unit" u ON bk."unitId" = u.id
      JOIN "Block" b ON u."blockId" = b.id
      JOIN "Project" p ON b."projectId" = p.id
      WHERE bk."organizationId" = ${organizationId}
    `;

    // 3. Договоры (сделки перешедшие в статус CONTRACT)
    const contracts: any[] = await prisma.$queryRaw`
      SELECT 
        d.id as "dealId",
        a."createdAt" as "signedAt",
        p.id as "projectId",
        p."nameRu" as "projectName",
        COALESCE(u.price, 0)::double precision as "amount"
      FROM "AuditLog" a
      JOIN "Deal" d ON a."entityId" = d.id
      JOIN "Unit" u ON d."unitId" = u.id
      JOIN "Block" b ON u."blockId" = b.id
      JOIN "Project" p ON b."projectId" = p.id
      WHERE a."entityType" = 'Deal'
        AND a."fieldName" = 'status'
        AND a."newValue" = 'CONTRACT'
        AND d."organizationId" = ${organizationId}
    `;

    // 4. Оплаты (фактически проведенные транзакции)
    const payments: any[] = await prisma.$queryRaw`
      SELECT 
        t.id as "transactionId",
        t.amount as "paidAmount",
        t.date as "paidAt",
        b."projectId" as "projectId",
        p."nameRu" as "projectName"
      FROM "Transaction" t
      JOIN "PaymentSchedule" ps ON t."paymentScheduleId" = ps.id
      JOIN "Deal" d ON ps."dealId" = d.id
      JOIN "Unit" u ON d."unitId" = u.id
      JOIN "Block" b ON u."blockId" = b.id
      JOIN "Project" p ON b."projectId" = p.id
      WHERE t."organizationId" = ${organizationId}
    `;

    // 5. Встречи (сделки перешедшие в статус CONSULTATION)
    const visits: any[] = await prisma.$queryRaw`
      SELECT 
        d.id as "dealId",
        a."createdAt" as "visitedAt",
        p.id as "projectId",
        p."nameRu" as "projectName"
      FROM "AuditLog" a
      JOIN "Deal" d ON a."entityId" = d.id
      JOIN "Unit" u ON d."unitId" = u.id
      JOIN "Block" b ON u."blockId" = b.id
      JOIN "Project" p ON b."projectId" = p.id
      WHERE a."entityType" = 'Deal'
        AND a."fieldName" = 'status'
        AND a."newValue" = 'CONSULTATION'
        AND d."organizationId" = ${organizationId}
    `;

    // 6. Заявки (сделки перешедшие в статус CONTRACT_PREPARATION)
    const applications: any[] = await prisma.$queryRaw`
      SELECT 
        d.id as "dealId",
        a."createdAt" as "appliedAt",
        p.id as "projectId",
        p."nameRu" as "projectName"
      FROM "AuditLog" a
      JOIN "Deal" d ON a."entityId" = d.id
      JOIN "Unit" u ON d."unitId" = u.id
      JOIN "Block" b ON u."blockId" = b.id
      JOIN "Project" p ON b."projectId" = p.id
      WHERE a."entityType" = 'Deal'
        AND a."fieldName" = 'status'
        AND a."newValue" = 'CONTRACT_PREPARATION'
        AND d."organizationId" = ${organizationId}
    `;

    return {
      leads: leads.map(r => ({
        id: r.id,
        createdAt: r.createdAt ? r.createdAt.toISOString() : null,
        projectId: r.projectId,
        projectName: r.projectName
      })),
      bookings: bookings.map(r => ({
        id: r.id,
        createdAt: r.createdAt ? r.createdAt.toISOString() : null,
        projectId: r.projectId,
        projectName: r.projectName
      })),
      contracts: contracts.map(r => ({
        dealId: r.dealId,
        signedAt: r.signedAt ? r.signedAt.toISOString() : null,
        projectId: r.projectId,
        projectName: r.projectName,
        amount: convertPrice(r.amount, r.projectName)
      })),
      payments: payments.map(r => ({
        transactionId: r.transactionId,
        paidAmount: convertPrice(r.paidAmount, r.projectName),
        paidAt: r.paidAt ? r.paidAt.toISOString() : null,
        projectId: r.projectId,
        projectName: r.projectName
      })),
      visits: visits.map(r => ({
        dealId: r.dealId,
        visitedAt: r.visitedAt ? r.visitedAt.toISOString() : null,
        projectId: r.projectId,
        projectName: r.projectName
      })),
      applications: applications.map(r => ({
        dealId: r.dealId,
        appliedAt: r.appliedAt ? r.appliedAt.toISOString() : null,
        projectId: r.projectId,
        projectName: r.projectName
      }))
    };
  } catch (e) {
    console.error('getSalesDynamicsReportData error:', e);
    return { leads: [], bookings: [], contracts: [], payments: [], visits: [], applications: [] };
  }
}

// RPT-007: Когортный анализ клиентов (Группировка по дате создания лида, расчет конверсии и цикла)
export async function getCohortAnalysisReportData(organizationId: string) {
  try {
    const rawData: any[] = await prisma.$queryRaw`
      SELECT 
        l.id as "leadId",
        COALESCE(l.source, 'Не указан') as "source",
        l."createdAt" as "leadCreatedAt",
        (
          SELECT d.id
          FROM "Deal" d
          WHERE d."leadId" = l.id
          ORDER BY CASE WHEN d.status IN ('SUCCESS', 'PAYMENT_CONFIRMED') THEN 1 ELSE 2 END ASC, d."updatedAt" DESC
          LIMIT 1
        ) as "dealId",
        (
          SELECT d.status::text
          FROM "Deal" d
          WHERE d."leadId" = l.id
          ORDER BY CASE WHEN d.status IN ('SUCCESS', 'PAYMENT_CONFIRMED') THEN 1 ELSE 2 END ASC, d."updatedAt" DESC
          LIMIT 1
        ) as "dealStatus",
        (
          SELECT d."updatedAt"
          FROM "Deal" d
          WHERE d."leadId" = l.id
          ORDER BY CASE WHEN d.status IN ('SUCCESS', 'PAYMENT_CONFIRMED') THEN 1 ELSE 2 END ASC, d."updatedAt" DESC
          LIMIT 1
        ) as "dealUpdatedAt",
        (
          SELECT COALESCE(SUM(u.price), 0)::double precision
          FROM "Deal" d
          JOIN "Unit" u ON d."unitId" = u.id
          WHERE d."leadId" = l.id AND d.status IN ('SUCCESS', 'PAYMENT_CONFIRMED')
        ) as "price",
        (
          SELECT p."nameRu"
          FROM "Deal" d
          JOIN "Unit" u ON d."unitId" = u.id
          JOIN "Block" b ON u."blockId" = b.id
          JOIN "Project" p ON b."projectId" = p.id
          WHERE d."leadId" = l.id
          LIMIT 1
        ) as "projectName",
        (
          SELECT p.id
          FROM "Deal" d
          JOIN "Unit" u ON d."unitId" = u.id
          JOIN "Block" b ON u."blockId" = b.id
          JOIN "Project" p ON b."projectId" = p.id
          WHERE d."leadId" = l.id
          LIMIT 1
        ) as "projectId"
      FROM "Lead" l
      WHERE l."organizationId" = ${organizationId}
    `;

    return rawData.map(row => ({
      leadId: row.leadId,
      source: row.source,
      leadCreatedAt: row.leadCreatedAt ? row.leadCreatedAt.toISOString() : null,
      dealId: row.dealId,
      dealStatus: row.dealStatus,
      dealUpdatedAt: row.dealUpdatedAt ? row.dealUpdatedAt.toISOString() : null,
      price: convertPrice(row.price, row.projectName),
      projectId: row.projectId,
      projectName: row.projectName
    }));
  } catch (e) {
    console.error('getCohortAnalysisReportData error:', e);
    return [];
  }
}

// RPT-011: Отчёт по индивидуальным скидкам (сделки с discount > 0)
export async function getDiscountReportData(organizationId: string) {
  try {
    const rawData: any[] = await prisma.$queryRaw`
      SELECT
        d.id as "dealId",
        l.name as "clientName",
        u.number as "unitNumber",
        u.price as "basePrice",
        COALESCE(d."discount", 0) as "discountPct",
        COALESCE(d."managerId", 'Не назначен') as "managerId",
        b."projectId" as "projectId",
        d."createdAt" as "createdAt"
      FROM "Deal" d
      JOIN "Lead" l ON d."leadId" = l.id
      JOIN "Unit" u ON d."unitId" = u.id
      JOIN "Block" b ON u."blockId" = b.id
      WHERE d."organizationId" = ${organizationId}
        AND COALESCE(d."discount", 0) > 0
      ORDER BY d."discount" DESC
    `;

    return rawData.map(row => {
      const discountAmount = parseFloat(((row.basePrice * row.discountPct) / 100).toFixed(2));
      const finalPrice = row.basePrice - discountAmount;
      return {
        dealId: row.dealId,
        clientName: row.clientName,
        unitNumber: row.unitNumber,
        basePrice: row.basePrice,
        discountPct: row.discountPct,
        discountAmount,
        finalPrice,
        managerId: row.managerId,
        projectId: row.projectId,
        createdAt: row.createdAt ? row.createdAt.toISOString().split('T')[0] : null
      };
    });
  } catch (e) {
    console.error('getDiscountReportData error:', e);
    return [];
  }
}

// RPT-012: Отчёт по ипотечным сделкам (сделки с paymentType = Mortgage)
export async function getMortgageReportData(organizationId: string) {
  try {
    const rawData: any[] = await prisma.$queryRaw`
      SELECT
        d.id as "dealId",
        l.name as "clientName",
        l.phone as "clientPhone",
        u.number as "unitNumber",
        u.price as "unitPrice",
        COALESCE(d."mortgageBank", 'Не указан') as "mortgageBank",
        COALESCE(d."mortgageStatus", 'NONE') as "mortgageStatus",
        COALESCE(d."mortgageComment", '') as "mortgageComment",
        COALESCE(d."totalAmount", 0) as "totalAmount",
        COALESCE(d."downPayment", 0) as "downPayment",
        COALESCE(d."managerId", 'Не назначен') as "managerId",
        b."projectId" as "projectId",
        d."createdAt" as "createdAt"
      FROM "Deal" d
      JOIN "Lead" l ON d."leadId" = l.id
      JOIN "Unit" u ON d."unitId" = u.id
      JOIN "Block" b ON u."blockId" = b.id
      WHERE d."organizationId" = ${organizationId}
        AND d."paymentType" = 'Mortgage'
      ORDER BY d."createdAt" DESC
    `;

    return rawData.map(row => ({
      dealId: row.dealId,
      clientName: row.clientName,
      clientPhone: row.clientPhone,
      unitNumber: row.unitNumber,
      unitPrice: row.unitPrice,
      mortgageBank: row.mortgageBank,
      mortgageStatus: row.mortgageStatus,
      mortgageComment: row.mortgageComment,
      totalAmount: row.totalAmount,
      downPayment: row.downPayment,
      loanAmount: row.totalAmount - row.downPayment,
      managerId: row.managerId,
      projectId: row.projectId,
      createdAt: row.createdAt ? row.createdAt.toISOString().split('T')[0] : null
    }));
  } catch (e) {
    console.error('getMortgageReportData error:', e);
    return [];
  }
}
