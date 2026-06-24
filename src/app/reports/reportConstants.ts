// Каталог всех 25 отчётов
export const REPORT_CATALOG = [
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

export const IMPLEMENTED_REPORTS = [
  'RPT-001', 'RPT-002', 'RPT-003', 'RPT-004', 'RPT-005', 'RPT-006', 'RPT-007',
  'RPT-008', 'RPT-009', 'RPT-010', 'RPT-011', 'RPT-012', 'RPT-013', 'RPT-014',
  'RPT-015', 'RPT-016', 'RPT-017', 'RPT-018', 'RPT-019', 'RPT-020', 'RPT-021',
  'RPT-022', 'RPT-023', 'RPT-024', 'RPT-025'
];

export const CATEGORIES = [
  { id: 'sales', name: 'Воронка и продажи' },
  { id: 'finance', name: 'Финансы и оплаты' },
  { id: 'units', name: 'Квартиры и остатки' },
  { id: 'clients', name: 'Клиенты' },
  { id: 'efficiency', name: 'Эффективность' }
];

export const CHANNELS = ['Social Media', 'Search Engine', 'Messenger', 'Portal', 'Direct'];

export const CHANNEL_TRANSLATIONS: Record<string, string> = {
  'Social Media': 'Социальные сети',
  'Search Engine': 'Поисковые системы',
  'Messenger': 'Мессенджеры',
  'Portal': 'Порталы недвижимости',
  'Direct': 'Прямые переходы'
};

export const UNIT_TYPE_TRANSLATIONS: Record<string, string> = {
  'Apartment': 'Квартира',
  'APARTMENT': 'Квартира',
  'Commercial': 'Коммерческое помещение',
  'COMMERCIAL': 'Коммерческое помещение',
  'Penthouse': 'Пентхаус',
  'PENTHOUSE': 'Пентхаус',
  'Office': 'Офис',
  'OFFICE': 'Офис',
  'Parking': 'Паркинг',
  'PARKING': 'Паркинг',
  'Garage': 'Гараж',
  'GARAGE': 'Гараж'
};

export const PAYMENT_TYPE_TRANSLATIONS: Record<string, string> = {
  'Installment': 'Рассрочка',
  'INSTALLMENT': 'Рассрочка',
  'Cash': 'Наличные',
  'CASH': 'Наличные',
  'Mortgage': 'Ипотека',
  'MORTGAGE': 'Ипотека',
  'Standard': 'Стандартный платеж',
  'STANDARD': 'Стандартный платеж',
  'None': 'Не указана',
  'NONE': 'Не указана'
};

export const LEAD_STATUS_TRANSLATIONS: Record<string, string> = {
  'NEW': 'Новый',
  'IN_QUALIFICATION': 'Квалификация',
  'QUALIFIED': 'Квалифицирован',
  'IN_PROGRESS': 'В работе',
  'CONVERTED': 'Конвертирован',
  'LOST': 'Потерян'
};

export const STAGE_ORDER = [
  'NEW_LEAD', 'CLARIFICATION', 'CALL', 'SECOND_CALL', 'THIRD_CALL',
  'CONSULTATION', 'PRE_RESERVATION', 'RESERVATION', 'CONTRACT_PREPARATION',
  'CONTRACT', 'CLIENT_CONFIRMATION', 'WAITING_PAYMENT', 'PAYMENT_CONFIRMED', 'SUCCESS'
];

export const STAGE_TRANSLATIONS: Record<string, string> = {
  'NEW_LEAD': 'Новый интерес',
  'CLARIFICATION': 'Уточнение деталей',
  'CALL': 'Первый звонок',
  'SECOND_CALL': 'Повторный звонок',
  'THIRD_CALL': 'Решающий звонок',
  'CONSULTATION': 'Консультация',
  'PRE_RESERVATION': 'Предбронь',
  'RESERVATION': 'Устная бронь',
  'CONTRACT_PREPARATION': 'Подготовка договора',
  'CONTRACT': 'Договор подписан',
  'CLIENT_CONFIRMATION': 'Подтверждение клиента',
  'WAITING_PAYMENT': 'Ожидание оплаты',
  'PAYMENT_CONFIRMED': 'Оплата подтверждена',
  'SUCCESS': 'Успешно завершено',
  'FAILED': 'Провал',
  'CANCELLED': 'Отменено'
};

export const STAGE_PROBABILITIES: Record<string, number> = {
  'NEW_LEAD': 0.05, 'CLARIFICATION': 0.10, 'CALL': 0.10, 'SECOND_CALL': 0.15,
  'THIRD_CALL': 0.20, 'CONSULTATION': 0.25, 'PRE_RESERVATION': 0.40,
  'RESERVATION': 0.60, 'CONTRACT_PREPARATION': 0.80, 'CONTRACT': 0.90,
  'CLIENT_CONFIRMATION': 0.90, 'WAITING_PAYMENT': 0.95, 'PAYMENT_CONFIRMED': 0.98,
  'SUCCESS': 1.00, 'FAILED': 0.00, 'CANCELLED': 0.00
};

// Типы
export interface ReportsClientProps {
  organizationId: string;
  userRole?: string;
  projects: { id: string; name: string }[];
  managers: string[];
  blocks: { id: string; number: string; projectId: string }[];
  sources: string[];
  paymentTypes: string[];
  unitTypes: string[];
  initialData: {
    funnelData: any[];
    dealTransitions: any[];
    projectSales: any[];
    managerSales: any[];
    cashFlow: any[];
    paymentRegistry: any[];
    debtors: any[];
    cashFlowReport: any[];
    managerKpi: any[];
    marketingChannels: any;
    contractDrafts: any[];
    salesDynamics: { leads: any[]; bookings: any[]; contracts: any[]; payments: any[]; visits: any[]; applications: any[] };
    cohortAnalysis: any[];
    discountReport: any[];
    mortgageReport: any[];
    taxInvoiceReport: any[];
    escrowReport: any[];
    availableUnits: any[];
    soldUnits: any[];
    projectExposure: any[];
    freeUnitsSearch: any[];
    priceHistory: any[];
    areaDiscrepancy: any[];
    vipClients: any[];
    clientDossier: any[];
    bookingReport: any[];
  };
  usdRate?: number;
}

// Вспомогательные функции
export function maskPhone(phone: string | null | undefined, role?: string): string {
  if (!phone) return '—';
  const roleLower = (role || '').toLowerCase();
  if (['admin', 'director', 'partner'].includes(roleLower)) return phone;
  const cleaned = phone.trim();
  if (cleaned.length <= 7) return '***';
  return cleaned.substring(0, 4) + '***' + cleaned.substring(cleaned.length - 3);
}

export function maskEmail(email: string | null | undefined, role?: string): string {
  if (!email) return '—';
  const roleLower = (role || '').toLowerCase();
  if (['admin', 'director', 'partner'].includes(roleLower)) return email;
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 3) return '***@' + domain;
  return name.substring(0, 3) + '***@' + domain;
}

export function maskIdNumber(identity: string | null | undefined, role?: string): string {
  if (!identity || identity === 'Не указан' || identity.trim() === '') return 'Не указан';
  const roleLower = (role || '').toLowerCase();
  if (['admin', 'director', 'partner'].includes(roleLower)) return identity;
  const cleaned = identity.trim();
  if (cleaned.length <= 6) return '***';
  return cleaned.substring(0, 3) + '***' + cleaned.substring(cleaned.length - 3);
}

export function getChannelBySource(source: string): string {
  if (!source) return 'Direct';
  const s = source.toLowerCase();
  if (s.includes('instagram') || s.includes('facebook') || s.includes('fb') || s.includes('insta')) return 'Social Media';
  if (s.includes('google') || s.includes('yandex') || s.includes('seo') || s.includes('search')) return 'Search Engine';
  if (s.includes('telegram') || s.includes('tg') || s.includes('whatsapp') || s.includes('viber')) return 'Messenger';
  if (s.includes('ge') || s.includes('portal') || s.includes('myhome') || s.includes('ss')) return 'Portal';
  return 'Direct';
}