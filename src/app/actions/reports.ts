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
        u.type as "unitType"
      FROM "Unit" u
      JOIN "Block" b ON u."blockId" = b.id
      JOIN "Project" p ON b."projectId" = p.id
      LEFT JOIN "Deal" d ON d."unitId" = u.id AND d.status IN ('SUCCESS', 'PAYMENT_CONFIRMED')
      WHERE p."organizationId" = ${organizationId}
        AND (u.status IN ('SOLD', 'DOWN_PAYMENT_RECEIVED') OR d.status IN ('SUCCESS', 'PAYMENT_CONFIRMED'))
    `;

    return rawData.map(row => {
      const price = convertPrice(row.price, row.projectName);
      const targetUnits = 10;
      const targetRevenue = 1500000.00; // План в USD

      return {
        dealId: row.dealId,
        projectId: row.projectId,
        projectName: row.projectName,
        wonAt: row.wonAt ? row.wonAt.toISOString().split('T')[0] : null,
        price,
        blockId: row.blockId,
        unitType: row.unitType,
        targetUnits,
        targetRevenue
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
        COALESCE(u.price, 0)::double precision as "price"
      FROM "Unit" u
      JOIN "Block" b ON u."blockId" = b.id
      JOIN "Project" p ON b."projectId" = p.id
      LEFT JOIN "Deal" d ON d."unitId" = u.id AND d.status IN ('SUCCESS', 'PAYMENT_CONFIRMED')
      WHERE p."organizationId" = ${organizationId}
        AND (u.status IN ('SOLD', 'DOWN_PAYMENT_RECEIVED') OR d.status IN ('SUCCESS', 'PAYMENT_CONFIRMED'))
    `;

    return rawData.map(row => {
      const price = convertPrice(row.price, row.projectName);
      const targetUnits = 5;
      const targetRevenue = 750000.00; // План в USD

      return {
        dealId: row.dealId,
        managerId: row.managerId,
        projectId: row.projectId,
        wonAt: row.wonAt ? row.wonAt.toISOString().split('T')[0] : null,
        price,
        targetUnits,
        targetRevenue
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
