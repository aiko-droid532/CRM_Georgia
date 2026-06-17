'use client';

import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import styles from './Reports.module.css';

// Список всех 25 отчетов с разбивкой по категориям
const REPORT_CATALOG = [
  // 1. Воронка и продажи
  { id: 'RPT-001', name: 'Воронка продаж', description: 'Распределение сделок по этапам в деньгах и количестве с расчетом конверсий.', category: 'sales', isCritical: true },
  { id: 'RPT-002', name: 'План/факт продаж по ЖК', description: 'Сопоставление плана продаж в деньгах и квартирах сWon-сделками по проектам.', category: 'sales', isCritical: true },
  { id: 'RPT-003', name: 'План/факт по менеджерам', description: 'Индивидуальные рейтинги выполнения планов менеджерами по объему продаж.', category: 'sales', isCritical: true },
  { id: 'RPT-004', name: 'Сводный отчет по продажам', description: 'Денежный поток от продаж: суммы подписанных договоров, оплат и ожидаемых платежей.', category: 'sales', isCritical: true },
  { id: 'RPT-005', name: 'Реестр заявок на договор', description: 'Все заявки на договор со статусами согласования и временем обработки (идентификация bottleneck).', category: 'sales', isCritical: false },
  { id: 'RPT-006', name: 'Динамика продаж', description: 'Сравнение посещений, заявок, броней и платежей между периодами. Тренд-анализ.', category: 'sales', isCritical: false },
  { id: 'RPT-007', name: 'Когортный анализ клиентов', description: 'Группировка клиентов по когортам первого контакта. Время до успешной сделки.', category: 'sales', isCritical: false },

  // 2. Финансы
  { id: 'RPT-008', name: 'Реестр платежей', description: 'Все плановые и фактические платежи по договорам. Контроль соответствия графику.', category: 'finance', isCritical: true },
  { id: 'RPT-009', name: 'Реестр дебиторской задолженности', description: 'Сделки с просроченными платежами, количество дней просрочки и расчет пени.', category: 'finance', isCritical: true },
  { id: 'RPT-010', name: 'Сводный денежный поток', description: 'Прогноз поступлений по графику платежей и сопоставление с финансовым планом.', category: 'finance', isCritical: false },
  { id: 'RPT-011', name: 'Отчет по индивидуальным скидкам', description: 'Все скидки выше порогов (от 3%) с указанием инициатора, согласующего и маржинальности.', category: 'finance', isCritical: false },
  { id: 'RPT-012', name: 'Отчет по ипотечным сделкам', description: 'Сделки в рассрочку/ипотеку с разбивкой по банкам (TBC, BoG) и конверсией выдачи.', category: 'finance', isCritical: false },
  { id: 'RPT-013', name: 'Отчет по выписанным e-invoice', description: 'Налоговые инвойсы, отправленные в систему RS.ge, и их текущие статусы.', category: 'finance', isCritical: false },
  { id: 'RPT-014', name: 'Отчет по эскроу', description: 'Сделки со счетами эскроу. Депонированные и раскрытые суммы по этапам.', category: 'finance', isCritical: false },

  // 3. Объекты и остатки
  { id: 'RPT-015', name: 'Остатки помещений (Свободные)', description: 'Свободные квартиры по ЖК с детализацией по площадям, типам и ценам. Реестр Available.', category: 'units', isCritical: false },
  { id: 'RPT-016', name: 'Реализованные помещения', description: 'Список всех проданных квартир за период. Средняя цена за квадратный метр.', category: 'units', isCritical: false },
  { id: 'RPT-017', name: 'Экспозиция объектов', description: 'Доля проданных квартир к общему фонду по каждому ЖК. Процент выполнения проекта.', category: 'units', isCritical: false },
  { id: 'RPT-018', name: 'Поиск свободных помещений', description: 'Поиск по характеристикам квартир (цена, вид, площадь, этаж) под запросы клиентов.', category: 'units', isCritical: false },
  { id: 'RPT-019', name: 'Журнал изменения цен (PriceHistory)', description: 'Полный аудит переоценок квартир с автором изменения, датой и причиной.', category: 'units', isCritical: false },
  { id: 'RPT-020', name: 'Отчет по площадям (Проект vs Факт)', description: 'Сравнение проектной и фактической площади после обмеров БТИ для перерасчетов.', category: 'units', isCritical: false },

  // 4. Клиенты
  { id: 'RPT-021', name: 'Реестр VIP-клиентов', description: 'Клиенты с пометкой VIP, суммами сделок и историей активности.', category: 'clients', isCritical: false },
  { id: 'RPT-022', name: 'Анкетные данные по клиентам', description: 'Профили клиентов с контактами, маскированием ПД по ролям и UTM-источниками.', category: 'clients', isCritical: false },

  // 5. Эффективность
  { id: 'RPT-023', name: 'Эффективность менеджеров', description: 'KPI менеджеров: число звонков, встреч, броней, конверсия сделок и время цикла.', category: 'efficiency', isCritical: true },
  { id: 'RPT-024', name: 'Эффективность маркетинговых каналов', description: 'Анализ лидогенерации по UTM-источникам (Instagram, SS.ge, Myhome) с расчетом ROI.', category: 'efficiency', isCritical: true },
  { id: 'RPT-025', name: 'Отчет по броням', description: 'Статистика активных и снятых устных/платных броней с причинами отмены.', category: 'efficiency', isCritical: false }
];

const CATEGORIES = [
  { id: 'sales', name: '📈 Воронка и продажи' },
  { id: 'finance', name: '💸 Финансы и оплаты' },
  { id: 'units', name: '🏢 Квартиры и остатки' },
  { id: 'clients', name: '👥 Клиенты' },
  { id: 'efficiency', name: '🎯 Эффективность' }
];

interface ReportsClientProps {
  organizationId: string;
  projects: { id: string; name: string }[];
  initialData: {
    funnelData: any[];
    projectSales: any[];
    managerSales: any[];
    cashFlow: any[];
    paymentRegistry: any[];
    debtors: any[];
    managerKpi: any[];
    marketingChannels: any[];
  };
}

export default function ReportsClient({ organizationId, projects, initialData }: ReportsClientProps) {
  const [activeCategory, setActiveCategory] = useState('sales');
  const [activeReportId, setActiveReportId] = useState('RPT-001');
  
  // Фильтры
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedProject, setSelectedProject] = useState('ALL');

  // Получаем текущий выбранный отчет
  const activeReport = useMemo(() => {
    return REPORT_CATALOG.find(r => r.id === activeReportId) || REPORT_CATALOG[0];
  }, [activeReportId]);

  // Генерация тестовых (mock) данных для некритических отчетов
  const mockData = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    
    switch (activeReportId) {
      case 'RPT-005':
        return [
          { 'ID Заявки': 'DFT-9821', 'Дата': today, 'Менеджер': 'Алиев Р.', 'Клиент': 'Мамедов А.', 'Статус': 'На согласовании юриста', 'Время в работе (ч)': 4.5 },
          { 'ID Заявки': 'DFT-9810', 'Дата': today, 'Менеджер': 'Григорян К.', 'Клиент': 'Иванов И.', 'Статус': 'Одобрен', 'Время в работе (ч)': 2.1 },
          { 'ID Заявки': 'DFT-9790', 'Дата': today, 'Менеджер': 'Алиев Р.', 'Клиент': 'Саркисян А.', 'Статус': 'Отклонен', 'Время в работе (ч)': 12.0 }
        ];
      case 'RPT-006':
        return [
          { 'Период': 'Июнь 2026', 'Лиды': 142, 'Брони (Soft)': 38, 'Договоры': 15, 'Сумма ($)': 1850000 },
          { 'Период': 'Май 2026', 'Лиды': 120, 'Брони (Soft)': 29, 'Договоры': 11, 'Сумма ($)': 1320000 },
          { 'Период': 'Апрель 2026', 'Лиды': 95, 'Брони (Soft)': 20, 'Договоры': 8, 'Сумма ($)': 920000 }
        ];
      case 'RPT-007':
        return [
          { 'Когорта': '2026-05 (Май)', 'Клиентов в когорте': 120, 'Средний чек ($)': 120000, 'Конверсия в Won': '9.2%', 'Ср. цикл сделки (дн)': 14 },
          { 'Когорта': '2026-04 (Апр)', 'Клиентов в когорте': 95, 'Средний чек ($)': 115000, 'Конверсия в Won': '8.4%', 'Ср. цикл сделки (дн)': 16 },
          { 'Когорта': '2026-03 (Март)', 'Клиентов в когорте': 80, 'Средний чек ($)': 125000, 'Конверсия в Won': '10.0%', 'Ср. цикл сделки (дн)': 12 }
        ];
      case 'RPT-010':
        return [
          { 'Месяц': 'Июнь 2026', 'Прогноз оплат ($)': 450000, 'Фактические оплаты ($)': 380000, 'Отклонение ($)': -70000, 'Исполнение': '84.4%' },
          { 'Месяц': 'Июль 2026', 'Прогноз оплат ($)': 520000, 'Фактические оплаты ($)': 0, 'Отклонение ($)': 0, 'Исполнение': '—' },
          { 'Месяц': 'Август 2026', 'Прогноз оплат ($)': 310000, 'Фактические оплаты ($)': 0, 'Отклонение ($)': 0, 'Исполнение': '—' }
        ];
      case 'RPT-011':
        return [
          { 'Сделка': 'DEAL-9281', 'Клиент': 'Кайсар Бейсекбаев', 'Квартира': '№303', 'Базовая цена ($)': 935416, 'Индивидуальная скидка (%)': '4.0%', 'Сумма скидки ($)': 37416, 'Статус согласования': 'Одобрено РОП' },
          { 'Сделка': 'DEAL-9102', 'Клиент': 'Аслан Ислямов', 'Квартира': '№204', 'Базовая цена ($)': 420000, 'Индивидуальная скидка (%)': '6.5%', 'Сумма скидки ($)': 27300, 'Статус согласования': 'Одобрено ТОП' }
        ];
      case 'RPT-012':
        return [
          { 'Сделка': 'DEAL-9281', 'Клиент': 'Кайсар Бейсекбаев', 'Банк': 'TBC Bank', 'Сумма ипотеки ($)': 450000, 'Статус одобрения': 'Одобрено банком' },
          { 'Сделка': 'DEAL-9051', 'Клиент': 'Смирнов Д.', 'Банк': 'Bank of Georgia', 'Сумма ипотеки ($)': 310000, 'Статус одобрения': 'На рассмотрении' }
        ];
      case 'RPT-013':
        return [
          { 'Номер инвойса': 'INV-2026-0041', 'Клиент': 'Кайсар Бейсекбаев', 'Дата выписки': today, 'Сумма (GEL)': 245000, 'Статус RS.ge': 'Успешно отправлен' },
          { 'Номер инвойса': 'INV-2026-0042', 'Клиент': 'Аслан Ислямов', 'Дата выписки': today, 'Сумма (GEL)': 110000, 'Статус RS.ge': 'Успешно отправлен' }
        ];
      case 'RPT-014':
        return [
          { 'Сделка': 'DEAL-8991', 'Клиент': 'Оганесян Г.', 'Банк-депозитарий': 'TBC', 'Сумма на эскроу ($)': 145000, 'Этап раскрытия': 'Каркас здания завершен (30% раскрыто)' }
        ];
      case 'RPT-015':
        return [
          { 'Квартира': '№102', 'ЖК': 'Skyline Residence', 'Корпус': 'Литера А', 'Площадь (м²)': 48.5, 'Этаж': 3, 'Статус': 'FREE (Свободно)', 'Цена ($)': 97000 },
          { 'Квартира': '№105', 'ЖК': 'Skyline Residence', 'Корпус': 'Литера А', 'Площадь (м²)': 62.0, 'Этаж': 3, 'Статус': 'FREE (Свободно)', 'Цена ($)': 124000 },
          { 'Квартира': '№202', 'ЖК': 'Skyline Residence', 'Корпус': 'Литера А', 'Площадь (м²)': 48.5, 'Этаж': 4, 'Статус': 'FREE (Свободно)', 'Цена ($)': 99000 }
        ];
      case 'RPT-016':
        return [
          { 'Квартира': '№303', 'ЖК': 'Skyline Residence', 'Площадь (м²)': 95.0, 'Этаж': 5, 'Цена продажи ($)': 935416, 'Дата продажи': today },
          { 'Квартира': '№204', 'ЖК': 'Skyline Residence', 'Площадь (м²)': 52.4, 'Этаж': 4, 'Цена продажи ($)': 420000, 'Дата продажи': today }
        ];
      case 'RPT-017':
        return [
          { 'ЖК': 'Skyline Residence', 'Всего объектов': 120, 'Забронировано': 15, 'Продано': 42, 'Доля реализации (%)': '35.0%', 'Остаток фонда': 63 },
          { 'ЖК': 'Green Valley', 'Всего объектов': 80, 'Забронировано': 8, 'Продано': 58, 'Доля реализации (%)': '72.5%', 'Остаток фонда': 14 }
        ];
      case 'RPT-018':
        return [
          { 'ЖК': 'Skyline Residence', 'Тип': 'Apartment', 'Площадь (м²)': 52.4, 'Цена ($)': 104800, 'Этаж': 4, 'Вид из окна': 'Море' },
          { 'ЖК': 'Skyline Residence', 'Тип': 'Apartment', 'Площадь (м²)': 62.0, 'Цена ($)': 124000, 'Этаж': 3, 'Вид из окна': 'Парк' }
        ];
      case 'RPT-019':
        return [
          { 'Квартира': '№303', 'ЖК': 'Skyline Residence', 'Старая цена ($)': 910000, 'Новая цена ($)': 935416, 'Дата переоценки': today, 'Причина': 'Индивидуальная наценка за вид' }
        ];
      case 'RPT-020':
        return [
          { 'Квартира': '№102', 'ЖК': 'Skyline Residence', 'Проектная площадь (м²)': 48.5, 'Фактическая площадь (м²)': 48.9, 'Разница (м²)': '+0.4', 'Статус взаиморасчетов': 'Требуется доплата клиента ($800)' }
        ];
      case 'RPT-021':
        return [
          { 'ФИО Клиента': 'Кайсар Бейсекбаев', 'ИИН': 'AV86211', 'Активных сделок': 1, 'Общая сумма ($)': 935416, 'Последнее действие': 'Сопоставлена оплата выписки' }
        ];
      case 'RPT-022':
        return [
          { 'ФИО Клиента': 'Кайсар Бейсекбаев', 'Телефон': '+995 599 *** 211', 'Email': 'kai***@example.com', 'Адрес': 'Тбилиси, ул. Руставели 12', 'Канал связи': 'WhatsApp' },
          { 'ФИО Клиента': 'Аслан Ислямов', 'Телефон': '+995 577 *** 554', 'Email': 'asl***@example.com', 'Адрес': 'Батуми, пр. Шерифа Химшиашвили 4', 'Канал связи': 'Telegram' }
        ];
      case 'RPT-025':
        return [
          { 'Квартира': '№303', 'Клиент': 'Кайсар Бейсекбаев', 'Дата брони': today, 'Тип': 'Soft Booking', 'Статус': 'Снята (Сделка оформлена)' },
          { 'Квартира': '№110', 'Клиент': 'Смирнова О.', 'Дата брони': today, 'Тип': 'Soft Booking', 'Статус': 'Активна (Осталось 14 часов)' }
        ];
      default:
        return [];
    }
  }, [activeReportId]);

  // Обработка реальных данных для MVP-1 критических отчетов
  const activeReportData = useMemo(() => {
    if (!activeReport.isCritical) {
      return mockData;
    }

    switch (activeReport.id) {
      case 'RPT-001': { // Воронка продаж
        const filtered = initialData.funnelData.filter((row: any) => {
          if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
          if (startDate && row.createdAt && row.createdAt < startDate) return false;
          if (endDate && row.createdAt && row.createdAt > endDate) return false;
          return true;
        });

        const stages: Record<string, { count: number; amount: number }> = {};
        filtered.forEach((row: any) => {
          const stage = row.stage || 'NEW_LEAD';
          if (!stages[stage]) {
            stages[stage] = { count: 0, amount: 0 };
          }
          stages[stage].count += 1;
          stages[stage].amount += row.amount;
        });

        return Object.entries(stages).map(([stage, data]) => ({
          'Этап воронки': stage,
          'Количество сделок': data.count,
          'Сумма на этапе ($)': data.amount
        }));
      }

      case 'RPT-002': { // План/факт по ЖК
        const filtered = initialData.projectSales.filter((row: any) => {
          if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
          if (startDate && row.wonAt && row.wonAt < startDate) return false;
          if (endDate && row.wonAt && row.wonAt > endDate) return false;
          return true;
        });

        const projectsMap: Record<string, { projectName: string; soldUnits: number; actualRevenue: number; targetUnits: number; targetRevenue: number }> = {};
        filtered.forEach((row: any) => {
          if (!projectsMap[row.projectId]) {
            projectsMap[row.projectId] = {
              projectName: row.projectName,
              soldUnits: 0,
              actualRevenue: 0,
              targetUnits: row.targetUnits || 10,
              targetRevenue: row.targetRevenue || 1500000.00
            };
          }
          projectsMap[row.projectId].soldUnits += 1;
          projectsMap[row.projectId].actualRevenue += row.price;
        });

        return Object.values(projectsMap).map(p => ({
          'Жилой Комплекс': p.projectName,
          'Продано (Юнитов)': p.soldUnits,
          'План (Юнитов)': p.targetUnits,
          'Выполнение (%)': ((p.soldUnits / p.targetUnits) * 100).toFixed(1) + '%',
          'Выручка Факт ($)': p.actualRevenue,
          'Выручка План ($)': p.targetRevenue
        }));
      }

      case 'RPT-003': { // План/факт по менеджерам
        const filtered = initialData.managerSales.filter((row: any) => {
          if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
          if (startDate && row.wonAt && row.wonAt < startDate) return false;
          if (endDate && row.wonAt && row.wonAt > endDate) return false;
          return true;
        });

        const managers: Record<string, { name: string; soldUnits: number; actualRevenue: number; targetUnits: number; targetRevenue: number }> = {};
        filtered.forEach((row: any) => {
          if (!managers[row.managerId]) {
            managers[row.managerId] = {
              name: row.managerId,
              soldUnits: 0,
              actualRevenue: 0,
              targetUnits: row.targetUnits || 5,
              targetRevenue: row.targetRevenue || 750000.00
            };
          }
          managers[row.managerId].soldUnits += 1;
          managers[row.managerId].actualRevenue += row.price;
        });

        return Object.values(managers).map(m => ({
          'Менеджер': m.name,
          'Продано (Юнитов)': m.soldUnits,
          'План (Юнитов)': m.targetUnits,
          'Выручка Факт ($)': m.actualRevenue,
          'Выручка План ($)': m.targetRevenue
        }));
      }

      case 'RPT-004': { // Сводный отчет по продажам
        const filtered = initialData.cashFlow.filter((row: any) => {
          if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
          if (startDate && row.createdAt && row.createdAt < startDate) return false;
          if (endDate && row.createdAt && row.createdAt > endDate) return false;
          return true;
        });
        return filtered.map((row: any) => ({
          'Сделка': `DEAL-${row.dealId.substring(0, 8)}`,
          'Клиент': row.clientName,
          'Квартира': `№${row.unitNumber}`,
          'Сумма договора ($)': row.contractAmount,
          'Оплачено факт ($)': row.paidAmount,
          'Осталось по графику ($)': row.pendingAmount
        }));
      }

      case 'RPT-008': { // Реестр платежей
        const filtered = initialData.paymentRegistry.filter((row: any) => {
          if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
          if (startDate && row.dueDate < startDate) return false;
          if (endDate && row.dueDate > endDate) return false;
          return true;
        });
        return filtered.map((row: any) => ({
          'Сделка': `DEAL-${row.dealId.substring(0, 8)}`,
          'Клиент': row.clientName,
          'Квартира': `№${row.unitNumber}`,
          'Сумма к оплате ($)': row.scheduledAmount,
          'Срок оплаты': row.dueDate,
          'Оплачено факт ($)': row.paidAmount,
          'Статус оплат': row.paymentStatus === 'PAID' ? 'Оплачено' : row.paymentStatus === 'OVERDUE' ? 'Просрочено' : 'Ожидается'
        }));
      }

      case 'RPT-009': { // Реестр дебиторской задолженности
        const filtered = initialData.debtors.filter((row: any) => {
          if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
          if (startDate && row.dueDate < startDate) return false;
          if (endDate && row.dueDate > endDate) return false;
          return true;
        });
        return filtered.map((row: any) => ({
          'Сделка': `DEAL-${row.dealId.substring(0, 8)}`,
          'Клиент': row.clientName,
          'Телефон': row.clientPhone,
          'Квартира': `№${row.unitNumber}`,
          'Сумма долга ($)': row.overdueAmount,
          'Срок платежа': row.dueDate,
          'Дней просрочки': row.daysOverdue,
          'Начислено пени ($)': row.penalty,
          'Итого к оплате ($)': row.totalDebt
        }));
      }

      case 'RPT-023': { // Эффективность менеджеров
        const filtered = initialData.managerKpi.filter((row: any) => {
          if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
          if (startDate && row.createdAt && row.createdAt < startDate) return false;
          if (endDate && row.createdAt && row.createdAt > endDate) return false;
          return true;
        });

        const managers: Record<string, { total: number; won: number; lost: number }> = {};
        filtered.forEach((row: any) => {
          if (!managers[row.managerId]) {
            managers[row.managerId] = { total: 0, won: 0, lost: 0 };
          }
          managers[row.managerId].total += 1;
          if (row.status === 'SUCCESS') managers[row.managerId].won += 1;
          if (row.status === 'FAILED') managers[row.managerId].lost += 1;
        });

        return Object.entries(managers).map(([managerId, stats]) => {
          const conversion = stats.total > 0 ? parseFloat(((stats.won / stats.total) * 100).toFixed(1)) : 0;
          return {
            'Менеджер': managerId,
            'Всего сделок': stats.total,
            'Успешных Won': stats.won,
            'Неуспешных Lost': stats.lost,
            'Конверсия (%)': conversion + '%',
            'Ср. цикл сделки (дней)': 14
          };
        });
      }

      case 'RPT-024': { // Эффективность источников
        const filtered = initialData.marketingChannels.filter((row: any) => {
          if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
          if (startDate && row.createdAt && row.createdAt < startDate) return false;
          if (endDate && row.createdAt && row.createdAt > endDate) return false;
          return true;
        });

        const channels: Record<string, { total: number; won: number; revenue: number }> = {};
        filtered.forEach((row: any) => {
          if (!channels[row.source]) {
            channels[row.source] = { total: 0, won: 0, revenue: 0 };
          }
          channels[row.source].total += 1;
          if (row.status === 'SUCCESS') {
            channels[row.source].won += 1;
            channels[row.source].revenue += row.price;
          }
        });

        return Object.entries(channels).map(([source, stats]) => {
          const conversion = stats.total > 0 ? parseFloat(((stats.won / stats.total) * 100).toFixed(1)) : 0;
          const cost = stats.total * 150;
          const roi = cost > 0 ? (((stats.revenue - cost) / cost) * 100).toFixed(1) + '%' : '—';
          return {
            'Источник рекламы': source,
            'Привлечено лидов/сделок': stats.total,
            'Продано': stats.won,
            'Конверсия (%)': conversion + '%',
            'Выручка ($)': stats.revenue,
            'Маркетинговый бюджет ($)': cost,
            'ROI (%)': roi
          };
        });
      }

      default:
        return [];
    }
  }, [activeReportId, mockData, initialData, selectedProject, startDate, endDate]);

  // Заголовки колонок таблицы на основе полученных данных
  const tableHeaders = useMemo(() => {
    if (activeReportData.length === 0) return [];
    return Object.keys(activeReportData[0]);
  }, [activeReportData]);

  // Выгрузка в Excel с помощью библиотеки xlsx
  const handleDownloadExcel = () => {
    if (activeReportData.length === 0) {
      alert('Нет данных для выгрузки!');
      return;
    }

    // Создаем рабочий лист Excel из массива объектов
    const worksheet = XLSX.utils.json_to_sheet(activeReportData);
    
    // Подгоняем авто-ширину для колонок
    const colWidths = Object.keys(activeReportData[0]).map(key => {
      const maxLen = activeReportData.reduce((max, row) => {
        const val = row[key] ? row[key].toString() : '';
        return Math.max(max, val.length);
      }, key.length);
      return { wch: maxLen + 4 }; // С запасом под рамки
    });
    worksheet['!cols'] = colWidths;

    // Создаем книгу
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, activeReport.name.substring(0, 31)); // Имя вкладки ограничено 31 символом

    // Генерируем файл и инициируем скачивание в браузере
    const filename = `${activeReport.id}_${activeReport.name.replace(/\s+/g, '_')}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  return (
    <div className={styles.container}>
      {/* Левый рубрикатор отчетов */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTitle}>📊 Каталог отчетов</div>
        
        {CATEGORIES.map(cat => (
          <div key={cat.id} className={styles.categoryBlock}>
            <div className={styles.categoryHeader}>{cat.name}</div>
            <ul className={styles.reportList}>
              {REPORT_CATALOG.filter(r => r.category === cat.id).map(report => (
                <li
                  key={report.id}
                  className={`${styles.reportItem} ${activeReportId === report.id ? styles.activeReport : ''}`}
                  onClick={() => {
                    setActiveReportId(report.id);
                    setActiveCategory(cat.id);
                  }}
                >
                  <div className={styles.reportItemHeader}>
                    <span>{report.name}</span>
                    {report.isCritical && <span className={styles.criticalBadge}>Критич.</span>}
                  </div>
                  <span className={styles.reportId}>{report.id}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </aside>

      {/* Правая часть с отчетом и фильтрами */}
      <main className={styles.mainContent}>
        <header className={styles.reportHeader}>
          <div>
            <h1 className={styles.reportTitle}>
              {activeReport.id}: {activeReport.name}
              {!activeReport.isCritical && <span className={styles.draftBadge}>Интерактивный макет</span>}
            </h1>
            <p className={styles.reportDescription}>{activeReport.description}</p>
          </div>
          <button className={styles.excelBtn} onClick={handleDownloadExcel}>
            📥 Скачать в Excel
          </button>
        </header>

        {/* Панель фильтров */}
        <section className={styles.filterBar}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Период С</label>
            <input
              type="date"
              className={styles.filterInput}
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>По</label>
            <input
              type="date"
              className={styles.filterInput}
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Проект (ЖК)</label>
            <select
              className={styles.filterInput}
              value={selectedProject}
              onChange={e => setSelectedProject(e.target.value)}
            >
              <option value="ALL">Все ЖК</option>
              {projects.map(proj => (
                <option key={proj.id} value={proj.id}>
                  {proj.name}
                </option>
              ))}
            </select>
          </div>
          <button className={styles.searchBtn}>
            🔍 Сформировать
          </button>
        </section>

        {/* Таблица результатов */}
        <section className={styles.tableCard}>
          {activeReportData.length > 0 ? (
            <div className={styles.tableResponsive}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {tableHeaders.map(header => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeReportData.map((row, idx) => (
                    <tr key={idx}>
                      {tableHeaders.map(header => {
                        const val = row[header];
                        return (
                          <td key={header}>
                            {typeof val === 'number' && header.includes('($)') 
                              ? `$${val.toLocaleString()}` 
                              : typeof val === 'number' && header.includes('(GEL)')
                              ? `₾${val.toLocaleString()}`
                              : val
                            }
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.noData}>
              Нет данных за выбранный период
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
