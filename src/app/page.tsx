import { cookies } from 'next/headers';
import { db as prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import styles from './page.module.css';

import FunnelView from './FunnelView';

type FunnelItem = {
  key: string;
  label: string;
  type: 'normal' | 'group' | 'child';
  statusKeys?: string[];
};

const FUNNEL_STRUCTURE: FunnelItem[] = [
  { key: 'NEW_LEAD', label: 'Новый лид', type: 'normal' },
  { key: 'CLARIFICATION', label: 'Уточнение', type: 'normal' },
  { key: 'CALL', label: 'Звонок', type: 'group', statusKeys: ['CALL', 'SECOND_CALL', 'THIRD_CALL'] },
  { key: 'SECOND_CALL', label: 'Второй звонок', type: 'child' },
  { key: 'THIRD_CALL', label: 'Третий звонок', type: 'child' },
  { key: 'CONSULTATION', label: 'Личная консультация', type: 'normal' },
  { key: 'PRE_RESERVATION', label: 'Бронирование (Soft)', type: 'normal' },
  { key: 'RESERVATION', label: 'Предв. бронирование (Hard)', type: 'normal' },
  { key: 'CONTRACT_PREPARATION', label: 'Готовность к сделке', type: 'normal' },
  { key: 'CONTRACT', label: 'Документ сформирован', type: 'normal' },
  { key: 'CLIENT_CONFIRMATION', label: 'Подтверждено клиентом', type: 'normal' },
  { key: 'WAITING_PAYMENT', label: 'Ожидание оплаты', type: 'normal' },
  { key: 'PAYMENT_CONFIRMED', label: 'Оплата подтверждена', type: 'normal' },
  { key: 'SUCCESS', label: 'Won (успешно)', type: 'normal' },
  { key: 'FAILED', label: 'Lost (отказ)', type: 'normal' },
  { key: 'CANCELLED', label: 'Cancelled (расторжение)', type: 'normal' }
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const cookieStore = cookies();
  const token = searchParams.token || cookieStore.get('auth_token')?.value;
  
  let organizationId = 'default';
  
  if (token) {
    try {
      const { payload } = await verifyToken(token);
      if (payload && typeof payload !== 'string') {
        organizationId = ((payload as any).app_metadata?.organization_id as string) || (payload.sub as string);
      }
    } catch {}
  }

  let leadsCount = 0;
  let dealsCount = 0;
  let totalRevenueUSD = 0;
  const statusData: Record<string, { count: number; money: number; avgMinutes: number }> = {};
  let dbError = false;
  let totalDealsAll = 0;
  let dealsWithDetails: any[] = [];

  try {
    // 1. Получаем количество лидов через прямой быстрый SQL
    const leadsCountResult: any[] = await prisma.$queryRaw`
      SELECT COUNT(*)::int as "count" FROM "Lead" WHERE "organizationId" = ${organizationId}
    `;
    leadsCount = leadsCountResult[0]?.count || 0;

    // 2. Получаем количество активных сделок через прямой SQL
    const dealsCountResult: any[] = await prisma.$queryRaw`
      SELECT COUNT(*)::int as "count" FROM "Deal" 
      WHERE "organizationId" = ${organizationId} AND "status"::text != 'FAILED'
    `;
    dealsCount = dealsCountResult[0]?.count || 0;

    // 3. Получаем все сделки со связанными лидами и квартирами в ОДИН JOIN-запрос
    const rawDeals: any[] = await prisma.$queryRaw`
      SELECT 
        d.id as "dealId",
        d.status as "dealStatus",
        d."organizationId" as "dealOrgId",
        d."managerId" as "dealManagerId",
        d."paymentType" as "dealPaymentType",
        d."downPayment" as "dealDownPayment",
        d."totalAmount" as "dealTotalAmount",
        d."createdAt" as "dealCreatedAt",
        d."updatedAt" as "dealUpdatedAt",
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
        u.price as "unitPrice",
        b.number as "blockNumber",
        p.name as "projectName"
      FROM "Deal" d
      LEFT JOIN "Lead" l ON d."leadId" = l.id
      LEFT JOIN "Unit" u ON d."unitId" = u.id
      LEFT JOIN "Block" b ON u."blockId" = b.id
      LEFT JOIN "Project" p ON b."projectId" = p.id
      WHERE d."organizationId" = ${organizationId}
      ORDER BY d."updatedAt" DESC
    `;

    // Преобразуем плоский SQL-результат в вложенную древовидную структуру для воронки
    dealsWithDetails = rawDeals.map(d => ({
      id: d.dealId,
      status: d.dealStatus,
      organizationId: d.dealOrgId,
      managerId: d.dealManagerId,
      paymentType: d.dealPaymentType,
      downPayment: d.dealDownPayment,
      totalAmount: d.dealTotalAmount,
      createdAt: d.dealCreatedAt,
      updatedAt: d.dealUpdatedAt,
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
        price: d.unitPrice,
        block: {
          number: d.blockNumber,
          project: {
            name: d.projectName
          }
        }
      } : null
    }));

    totalDealsAll = dealsWithDetails.length;
    const now = new Date();

    dealsWithDetails.forEach((deal: any) => {
      const s = deal.status as string;
      if (!statusData[s]) statusData[s] = { count: 0, money: 0, avgMinutes: 0 };
      
      statusData[s].count += 1;
      statusData[s].money += deal.unit?.price || 0;
      
      const diffMs = now.getTime() - new Date(deal.updatedAt).getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      statusData[s].avgMinutes += diffMins; 
    });

    // Расчет среднего времени нахождения на этапе воронки
    Object.keys(statusData).forEach(key => {
      const data = statusData[key];
      if (data.count > 0) {
        data.avgMinutes = Math.floor(data.avgMinutes / data.count);
      }
    });

    // 4. Получаем сумму выручки напрямую без кастов энумов Prisma (что ломало PgBouncer)
    const revenueResult: any[] = await prisma.$queryRaw`
      SELECT COALESCE(SUM("amount"), 0)::float as "total"
      FROM "PaymentSchedule"
      WHERE "organizationId" = ${organizationId} AND "status"::text = 'PAID'
    `;
    totalRevenueUSD = (revenueResult[0]?.total || 0) / 450;

  } catch (e) {
    console.error('[Dashboard] DB error:', e);
    dbError = true;
  }

  const stats = [
    { title: 'Всего лидов', value: leadsCount.toString(), icon: '👥', color: '#6366f1' },
    { title: 'Активные сделки', value: dealsCount.toString(), icon: '🤝', color: '#f59e0b' },
    { title: 'Выручка (факт)', value: `$${totalRevenueUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: '💰', color: '#10b981' },
    { title: 'Конверсия', value: leadsCount > 0 ? `${Math.round((dealsCount / leadsCount) * 100)}%` : '0%', icon: '📈', color: '#3b82f6' },
  ];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleSection}>
          <h1>Аналитика продаж</h1>
          <p className={styles.subtitle}>Воронка продаж · {totalDealsAll} сделок</p>
        </div>
        {dbError && (
          <div className={styles.errorBanner}>
            ⚠️ Ошибка БД. Проверьте .env (нужен знак ? перед параметрами)
          </div>
        )}
      </header>

      <div className={styles.statsGrid}>
        {stats.map((stat, i) => (
          <div key={i} className={styles.statCard}>
            <div className={styles.statIcon} style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>
              {stat.icon}
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statTitle}>{stat.title}</span>
              <h2 className={styles.statValue}>{stat.value}</h2>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.fullWidthCard}>
        <div className={styles.cardHeader}>
          <h3>Анализ воронки</h3>
        </div>
        <FunnelView 
          structure={FUNNEL_STRUCTURE} 
          statusData={statusData} 
          leadsCount={leadsCount} 
          deals={dealsWithDetails as any} 
        />
      </div>
    </div>
  );
}
