'use client';

import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import styles from './Reports.module.css';
import {
  REPORT_CATALOG,
  IMPLEMENTED_REPORTS,
  CATEGORIES,
  CHANNELS,
  CHANNEL_TRANSLATIONS,
  UNIT_TYPE_TRANSLATIONS,
  PAYMENT_TYPE_TRANSLATIONS,
  LEAD_STATUS_TRANSLATIONS,
  STAGE_ORDER,
  STAGE_TRANSLATIONS,
  STAGE_PROBABILITIES,
  ReportsClientProps,
  maskPhone,
  maskEmail,
  maskIdNumber,
  getChannelBySource,
} from './reportConstants';
import { getMockDataForReport } from './reportMockData';
import { getSalesReportData } from './reportDataSales';
import { getFinanceReportData } from './reportDataFinance';
import { getUnitsReportData } from './reportDataUnits';
import { getEfficiencyReportData } from './reportDataEfficiency';

export default function ReportsClient({
  organizationId,
  userRole = 'manager',
  projects,
  managers,
  blocks,
  sources,
  paymentTypes,
  unitTypes,
  initialData,
  usdRate = 2.7
}: ReportsClientProps) {
  const [activeCategory, setActiveCategory] = useState('sales');
  const [activeReportId, setActiveReportId] = useState('RPT-001');

  // Общие фильтры
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedProject, setSelectedProject] = useState('ALL');

  // Дополнительные фильтры для RPT-001 - RPT-004
  const [selectedManager, setSelectedManager] = useState('ALL');
  const [selectedSource, setSelectedSource] = useState('ALL');
  const [selectedChannel, setSelectedChannel] = useState('ALL');
  const [selectedPaymentType, setSelectedPaymentType] = useState('ALL');
  const [selectedClientType, setSelectedClientType] = useState('ALL'); // 'ALL' | 'VIP' | 'REGULAR'
  const [selectedBlock, setSelectedBlock] = useState('ALL');
  const [selectedUnitType, setSelectedUnitType] = useState('ALL');
  const [funnelViewMode, setFunnelViewMode] = useState('pipeline'); // 'pipeline' | 'conversion'

  // Фильтры для RPT-008
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('ALL'); // ALL | PAID | OVERDUE | PENDING

  // Фильтры для RPT-009
  const [selectedOverdueBucket, setSelectedOverdueBucket] = useState('ALL'); // ALL | 1-30 | 30-60 | 60-90 | 90+
  const [selectedDebtManager, setSelectedDebtManager] = useState('ALL');

  // Фильтры для RPT-010
  const [selectedCashFlowPaymentType, setSelectedCashFlowPaymentType] = useState('ALL');

  // Фильтры для RPT-011
  const [selectedDiscountRange, setSelectedDiscountRange] = useState('ALL'); // ALL | 0-3 | 3-5 | 5-10 | 10+
  const [selectedDiscountManager, setSelectedDiscountManager] = useState('ALL');

  // Фильтры для RPT-012
  const [selectedMortgageBank, setSelectedMortgageBank] = useState('ALL');
  const [selectedMortgageStatus, setSelectedMortgageStatus] = useState('ALL');

  // Фильтры для RPT-005
  const [draftStatusFilter, setDraftStatusFilter] = useState('ALL'); // ALL | IN_PROGRESS | APPROVED | REJECTED
  const [selectedInitiator, setSelectedInitiator] = useState('ALL');
  const [selectedApprover, setSelectedApprover] = useState('ALL');

  // Фильтры для RPT-006
  const [dynamicsInterval, setDynamicsInterval] = useState('month'); // day | week | month | quarter

  // Фильтры для RPT-007
  const [cohortInterval, setCohortInterval] = useState('month'); // week | month | quarter

  // Дополнительные фильтры для RPT-015 - RPT-020
  const [minArea, setMinArea] = useState('');
  const [maxArea, setMaxArea] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [filterFloor, setFilterFloor] = useState('');
  const [filterView, setFilterView] = useState('ALL');
  const [filterUnitNumber, setFilterUnitNumber] = useState('');
  const [filterInitiator, setFilterInitiator] = useState('ALL');
  const [dealStatusFilter, setDealStatusFilter] = useState('ALL');

  const [selectedBookingType, setSelectedBookingType] = useState('ALL');



  // Стейт для «Сформировать» — таблица и KPI-карточки показываются после нажатия
  const [reportGenerated, setReportGenerated] = useState(false);

  // Получаем текущий выбранный отчет
  const activeReport = useMemo(() => {
    return REPORT_CATALOG.find(r => r.id === activeReportId) || REPORT_CATALOG[0];
  }, [activeReportId]);

  const initiators = useMemo(() => {
    return Array.from(new Set(initialData.contractDrafts.map((row: any) => row.initiator).filter(Boolean))) as string[];
  }, [initialData.contractDrafts]);

  const approvers = useMemo(() => {
    return Array.from(new Set(initialData.contractDrafts.map((row: any) => row.approver).filter(Boolean))) as string[];
  }, [initialData.contractDrafts]);

  // При смене отчёта — сбрасываем специфичные фильтры и скрываем таблицу
  const handleSelectReport = (id: string, catId: string) => {
    setActiveReportId(id);
    setActiveCategory(catId);
    setReportGenerated(false);
    setSelectedPaymentStatus('ALL');
    setSelectedOverdueBucket('ALL');
    setSelectedDebtManager('ALL');
    setSelectedCashFlowPaymentType('ALL');
    setSelectedDiscountRange('ALL');
    setSelectedDiscountManager('ALL');
    setSelectedMortgageBank('ALL');
    setSelectedMortgageStatus('ALL');
    setDraftStatusFilter('ALL');
    setSelectedInitiator('ALL');
    setSelectedApprover('ALL');
    setDynamicsInterval('month');
    setCohortInterval('month');
    setMinArea('');
    setMaxArea('');
    setMinPrice('');
    setMaxPrice('');
    setFilterFloor('');
    setFilterView('ALL');
    setFilterUnitNumber('');
    setFilterInitiator('ALL');
    setDealStatusFilter('ALL');

    // Для денежного потока расширяем период — показываем прогноз на год вперёд
    if (id === 'RPT-010') {
      const yearAhead = new Date();
      yearAhead.setFullYear(yearAhead.getFullYear() + 1);
      setEndDate(yearAhead.toISOString().split('T')[0]);
    }
  };

  // Генерация тестовых (mock) данных для некритических отчетов
  // Мок-данные для отчётов без реальных данных (вынесены в reportMockData.ts)
  const mockData = useMemo(() => getMockDataForReport(activeReportId), [activeReportId]);

  // Обработчики данных вынесены в отдельные файлы по категориям
  const activeReportData = useMemo<any[]>(() => {
    if (!IMPLEMENTED_REPORTS.includes(activeReport.id)) {
      return mockData;
    }

    const salesReportIds = ['RPT-001', 'RPT-002', 'RPT-003', 'RPT-004', 'RPT-005', 'RPT-006', 'RPT-007'];
    const financeReportIds = ['RPT-008', 'RPT-009', 'RPT-010', 'RPT-011', 'RPT-012', 'RPT-013', 'RPT-014'];
    const unitsReportIds = ['RPT-015', 'RPT-016', 'RPT-017', 'RPT-018', 'RPT-019', 'RPT-020', 'RPT-021', 'RPT-022'];
    const efficiencyReportIds = ['RPT-023', 'RPT-024', 'RPT-025'];

    if (salesReportIds.includes(activeReport.id)) {
      return getSalesReportData(activeReport.id, {
        selectedProject, selectedManager, selectedSource, selectedChannel,
        selectedPaymentType, selectedClientType, selectedBlock, selectedUnitType,
        funnelViewMode, draftStatusFilter, dynamicsInterval, cohortInterval,
        dealStatusFilter, startDate, endDate, projects, blocks, usdRate, userRole
      }, initialData);
    }

    if (financeReportIds.includes(activeReport.id)) {
      return getFinanceReportData(activeReport.id, {
        selectedProject, selectedManager,
        selectedPaymentStatus, selectedOverdueBucket, selectedDebtManager,
        selectedCashFlowPaymentType, selectedDiscountRange, selectedDiscountManager,
        selectedMortgageBank, selectedMortgageStatus,
        startDate, endDate
      }, initialData);
    }

    if (unitsReportIds.includes(activeReport.id)) {
      return getUnitsReportData(activeReport.id, {
        selectedProject, selectedBlock, selectedUnitType, selectedSource, dealStatusFilter,
        selectedManager, filterUnitNumber, filterInitiator, filterFloor, filterView,
        minArea, maxArea, minPrice, maxPrice, startDate, endDate, blocks, userRole
      }, initialData);
    }

    if (efficiencyReportIds.includes(activeReport.id)) {
      return getEfficiencyReportData(activeReport.id, {
        selectedProject, selectedManager, selectedSource, selectedChannel,
        selectedBookingType, startDate, endDate
      }, initialData);
    }

    return [];
  }, [activeReportId, mockData, initialData, selectedProject, startDate, endDate, selectedManager, selectedSource, selectedChannel, selectedPaymentType, selectedClientType, selectedBlock, selectedUnitType, funnelViewMode, projects, blocks, usdRate, userRole, selectedPaymentStatus, selectedOverdueBucket, selectedDebtManager, selectedCashFlowPaymentType, selectedDiscountRange, selectedDiscountManager, selectedMortgageBank, selectedMortgageStatus, draftStatusFilter, dynamicsInterval, cohortInterval, dealStatusFilter, selectedInitiator, selectedApprover, minArea, maxArea, minPrice, maxPrice, filterFloor, filterView, filterUnitNumber, filterInitiator, selectedBookingType]);


  // Расчет динамических KPI показателей отчетов
  const reportStats = useMemo(() => {
    if (activeReportId === 'RPT-001') {
      let totalDeals = 0;
      let totalAmountUsd = 0;
      let totalAmountGel = 0;
      let successDeals = 0;

      const countKey = funnelViewMode === 'pipeline' ? 'Количество сделок' : 'Уникальных переходов';
      const usdKey = funnelViewMode === 'pipeline' ? 'Сумма (USD)' : 'Оборот этапа (USD)';
      const gelKey = funnelViewMode === 'pipeline' ? 'Сумма (GEL)' : 'Оборот этапа (GEL)';

      activeReportData.forEach(row => {
        const count = Number(row[countKey]) || 0;
        const usd = Number(row[usdKey]) || 0;
        const gel = Number(row[gelKey]) || 0;
        totalDeals += count;
        totalAmountUsd += usd;
        totalAmountGel += gel;
        if (row['Этап воронки'] === STAGE_TRANSLATIONS['SUCCESS'] || row['Этап воронки'] === STAGE_TRANSLATIONS['PAYMENT_CONFIRMED']) {
          successDeals += count;
        }
      });

      const conversion = totalDeals > 0 ? ((successDeals / totalDeals) * 100).toFixed(1) + '%' : '0.0%';

      const totalLabel = funnelViewMode === 'pipeline' ? 'Всего сделок' : 'Всего переходов';
      const totalSubtext = funnelViewMode === 'pipeline' ? 'В выбранном периоде' : 'Сумма переходов по этапам';

      return [
        { label: totalLabel, value: totalDeals.toString(), subtext: totalSubtext, icon: '💼' },
        { label: 'Общий бюджет', value: `$${totalAmountUsd.toLocaleString()}`, subtext: `₾${totalAmountGel.toLocaleString()}`, icon: '💰' },
        { label: 'Успешные сделки', value: successDeals.toString(), subtext: `Конверсия: ${conversion}`, icon: '🏆' }
      ];
    }

    if (activeReportId === 'RPT-002') {
      let totalSold = 0;
      let totalTargetUnits = 0;
      let totalRevenueFact = 0;
      let totalRevenuePlan = 0;

      activeReportData.forEach(row => {
        totalSold += Number(row['Продано (Юнитов)']) || 0;
        totalTargetUnits += Number(row['План (Юнитов)']) || 0;
        totalRevenueFact += Number(row['Выручка Факт ($)']) || 0;
        totalRevenuePlan += Number(row['Выручка План ($)']) || 0;
      });

      const unitCompletion = totalTargetUnits > 0 ? ((totalSold / totalTargetUnits) * 100).toFixed(1) + '%' : '0.0%';
      const revCompletion = totalRevenuePlan > 0 ? ((totalRevenueFact / totalRevenuePlan) * 100).toFixed(1) + '%' : '0.0%';

      return [
        { label: 'Продано юнитов', value: totalSold.toString(), subtext: `План: ${totalTargetUnits} (${unitCompletion})`, icon: '🏢' },
        { label: 'Выручка Факт', value: `$${totalRevenueFact.toLocaleString()}`, subtext: `План: $${totalRevenuePlan.toLocaleString()}`, icon: '💵' },
        { label: 'Выполнение плана', value: revCompletion, subtext: 'По сумме выручки', icon: '📈' }
      ];
    }

    if (activeReportId === 'RPT-003') {
      let totalSold = 0;
      let totalRevenue = 0;
      let topManager = '—';
      let maxRevenue = -1;

      activeReportData.forEach(row => {
        totalSold += Number(row['Продано (Юнитов)']) || 0;
        const rev = Number(row['Выручка Факт ($)']) || 0;
        totalRevenue += rev;
        if (rev > maxRevenue) {
          maxRevenue = rev;
          topManager = row['Менеджер'] || '—';
        }
      });

      return [
        { label: 'Всего продано', value: `${totalSold} шт.`, subtext: 'Всеми менеджерами', icon: '👤' },
        { label: 'Общая выручка', value: `$${totalRevenue.toLocaleString()}`, subtext: `В среднем: $${Math.round(activeReportData.length > 0 ? totalRevenue / activeReportData.length : 0).toLocaleString()}`, icon: '💰' },
        { label: 'Лидер продаж', value: topManager, subtext: maxRevenue > 0 ? `Результат: $${maxRevenue.toLocaleString()}` : 'Нет сделок', icon: '👑' }
      ];
    }

    if (activeReportId === 'RPT-004') {
      let totalContract = 0;
      let totalPaid = 0;
      let totalPending = 0;

      activeReportData.forEach(row => {
        totalContract += Number(row['Сумма договора ($)']) || 0;
        totalPaid += Number(row['Поступило оплат ($)']) || 0;
        totalPending += Number(row['Ожидается платежей ($)']) || 0;
      });

      return [
        { label: 'Сумма договоров', value: `$${totalContract.toLocaleString()}`, subtext: `Всего сделок: ${activeReportData.length}`, icon: '📝' },
        { label: 'Поступило оплат', value: `$${totalPaid.toLocaleString()}`, subtext: `Оплачено: ${totalContract > 0 ? ((totalPaid / totalContract) * 100).toFixed(1) + '%' : '0%'}`, icon: '📥' },
        { label: 'Ожидается платежей', value: `$${totalPending.toLocaleString()}`, subtext: `Остаток: ${totalContract > 0 ? ((totalPending / totalContract) * 100).toFixed(1) + '%' : '0%'}`, icon: '⏳' }
      ];
    }

    if (activeReportId === 'RPT-005') {
      const totalDrafts = activeReportData.length;
      let approvedDrafts = 0;
      let totalHours = 0;
      let countWithTime = 0;

      activeReportData.forEach(row => {
        if (row['Статус'] === 'Одобрен') {
          approvedDrafts++;
          totalHours += Number(row['Время в работе (ч)']) || 0;
          countWithTime++;
        }
      });

      const avgHours = countWithTime > 0 ? (totalHours / countWithTime).toFixed(1) : '0.0';

      return [
        { label: 'Всего заявок', value: totalDrafts.toString(), subtext: 'В выбранном периоде', icon: '' },
        { label: 'Одобрено договоров', value: approvedDrafts.toString(), subtext: `Доля: ${totalDrafts > 0 ? ((approvedDrafts / totalDrafts) * 100).toFixed(1) + '%' : '0.0%'}`, icon: '' },
        { label: 'Среднее время согласования', value: `${avgHours} ч.`, subtext: 'Для одобренных договоров', icon: '' }
      ];
    }

    if (activeReportId === 'RPT-006') {
      let totalLeads = 0;
      let totalVisits = 0;
      let totalApplications = 0;
      let totalBookings = 0;
      let totalContracts = 0;
      let totalPayments = 0;

      activeReportData.forEach(row => {
        totalLeads += Number(row['Лиды']) || 0;
        totalVisits += Number(row['Посещения']) || 0;
        totalApplications += Number(row['Заявки']) || 0;
        totalBookings += Number(row['Брони']) || 0;
        totalContracts += Number(row['Договоры']) || 0;
        totalPayments += Number(row['Поступило оплат ($)']) || 0;
      });

      return [
        { label: 'Лиды / Встречи / Заявки', value: `${totalLeads} / ${totalVisits} / ${totalApplications}`, subtext: 'Привлечено / Проведено / Подано', icon: '' },
        { label: 'Брони / Договоры', value: `${totalBookings} / ${totalContracts}`, subtext: `Конверсия в Won: ${totalLeads > 0 ? ((totalContracts / totalLeads) * 100).toFixed(1) + '%' : '0.0%'}`, icon: '' },
        { label: 'Фактическая выручка', value: `$${totalPayments.toLocaleString()}`, subtext: 'Сумма поступивших оплат', icon: '' }
      ];
    }

    if (activeReportId === 'RPT-007') {
      const filteredLeads = initialData.cohortAnalysis.filter((row: any) => {
        if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
        if (startDate && row.leadCreatedAt && row.leadCreatedAt.substring(0, 10) < startDate) return false;
        if (endDate && row.leadCreatedAt && row.leadCreatedAt.substring(0, 10) > endDate) return false;
        if (selectedSource !== 'ALL' && row.source !== selectedSource) return false;
        if (selectedChannel !== 'ALL' && getChannelBySource(row.source) !== selectedChannel) return false;
        return true;
      });

      const totalLeads = filteredLeads.length;
      let totalWon = 0;
      let totalRevenue = 0;

      filteredLeads.forEach((row: any) => {
        const isWon = row.dealStatus === 'SUCCESS' || row.dealStatus === 'PAYMENT_CONFIRMED';
        if (isWon) {
          totalWon++;
          totalRevenue += row.price || 0;
        }
      });

      const conversion = totalLeads > 0 ? ((totalWon / totalLeads) * 100).toFixed(1) + '%' : '0.0%';

      return [
        { label: 'Всего клиентов', value: totalLeads.toString(), subtext: 'В когортах за период', icon: '' },
        { label: 'Успешных сделок', value: totalWon.toString(), subtext: `Общий чек: $${totalRevenue.toLocaleString()}`, icon: '' },
        { label: 'Итоговая конверсия', value: conversion, subtext: 'Средняя по всем когортам', icon: '' }
      ];
    }

    if (activeReportId === 'RPT-008') {
      let totalScheduled = 0, totalPaid = 0, countOverdue = 0, countPending = 0;
      activeReportData.forEach(row => {
        totalScheduled += Number(row['Сумма к оплате ($)']) || 0;
        totalPaid += Number(row['Оплачено факт ($)']) || 0;
        if (row['Статус оплат'] === 'Просрочено') countOverdue++;
        if (row['Статус оплат'] === 'Ожидается') countPending++;
      });
      const paidPct = totalScheduled > 0 ? ((totalPaid / totalScheduled) * 100).toFixed(1) + '%' : '0%';
      return [
        { label: 'Всего платежей', value: activeReportData.length.toString(), subtext: `По графику: $${totalScheduled.toLocaleString()}`, icon: '📋' },
        { label: 'Поступило оплат', value: `$${totalPaid.toLocaleString()}`, subtext: `Исполнено: ${paidPct}`, icon: '✅' },
        { label: 'Просрочено', value: `${countOverdue} шт.`, subtext: `Ожидается ещё: ${countPending} шт.`, icon: '🔴' },
      ];
    }

    if (activeReportId === 'RPT-009') {
      let totalDebt = 0, totalPenalty = 0, totalOwed = 0, maxDays = 0;
      activeReportData.forEach(row => {
        totalDebt += Number(row['Сумма долга ($)']) || 0;
        totalPenalty += Number(row['Начислено пени ($)']) || 0;
        totalOwed += Number(row['Итого к оплате ($)']) || 0;
        const d = Number(row['Дней просрочки']) || 0;
        if (d > maxDays) maxDays = d;
      });
      return [
        { label: 'Должников', value: activeReportData.length.toString(), subtext: `Макс. просрочка: ${maxDays} дн.`, icon: '⚠️' },
        { label: 'Сумма основного долга', value: `$${totalDebt.toLocaleString()}`, subtext: 'По всем просрочкам', icon: '💸' },
        { label: 'Начислено пени', value: `$${totalPenalty.toLocaleString()}`, subtext: `Итого к взысканию: $${totalOwed.toLocaleString()}`, icon: '📌' },
      ];
    }

    if (activeReportId === 'RPT-010') {
      let pastScheduled = 0, totalPaid = 0, futureScheduled = 0;
      activeReportData.forEach(row => {
        const scheduled = Number(row['Прогноз / план ($)']) || 0;
        const paid = row['Фактически получено ($)'];
        if (paid === null) {
          // Будущий месяц — факта нет
          futureScheduled += scheduled;
        } else {
          // Прошедший месяц — есть и план и факт
          pastScheduled += scheduled;
          totalPaid += Number(paid) || 0;
        }
      });
      const execution = pastScheduled > 0
        ? ((totalPaid / pastScheduled) * 100).toFixed(1) + '%'
        : '—';
      return [
        { label: 'Получено (прошлые периоды)', value: `$${totalPaid.toLocaleString()}`, subtext: `План: $${pastScheduled.toLocaleString()} | Исполнение: ${execution}`, icon: '✅' },
        { label: 'Ожидается (будущие периоды)', value: `$${futureScheduled.toLocaleString()}`, subtext: 'По графику платежей', icon: '🔮' },
        { label: 'Итого по графику', value: `$${(totalPaid + futureScheduled).toLocaleString()}`, subtext: 'Факт + прогноз будущих', icon: '📅' },
      ];
    }

    if (activeReportId === 'RPT-011') {
      let totalDiscountAmount = 0, maxDiscount = 0, totalBase = 0;
      activeReportData.forEach(row => {
        totalDiscountAmount += Number(row['Сумма скидки ($)']) || 0;
        totalBase += Number(row['Базовая цена ($)']) || 0;
        const pct = parseFloat(row['Индивидуальная скидка (%)']) || 0;
        if (pct > maxDiscount) maxDiscount = pct;
      });
      const avgDiscount = totalBase > 0 ? ((totalDiscountAmount / totalBase) * 100).toFixed(1) + '%' : '—';
      return [
        { label: 'Сделок со скидкой', value: activeReportData.length.toString(), subtext: `Средняя скидка: ${avgDiscount}`, icon: '🏷️' },
        { label: 'Общая сумма скидок', value: `$${totalDiscountAmount.toLocaleString()}`, subtext: 'Суммарная потеря маржи', icon: '📉' },
        { label: 'Макс. скидка', value: `${maxDiscount}%`, subtext: 'Наибольшая в выборке', icon: '⚠️' }
      ];
    }

    if (activeReportId === 'RPT-012') {
      let totalLoan = 0, approved = 0, pending = 0, rejected = 0;
      activeReportData.forEach(row => {
        totalLoan += Number(row['Сумма кредита ($)']) || 0;
        const status = row['Статус ипотеки'] || '';
        if (status.includes('Одобрено')) approved++;
        if (status.includes('рассмотрении')) pending++;
        if (status.includes('Отклонено')) rejected++;
      });
      const approvalRate = activeReportData.length > 0
        ? ((approved / activeReportData.length) * 100).toFixed(0) + '%'
        : '—';
      return [
        { label: 'Ипотечных сделок', value: activeReportData.length.toString(), subtext: `Одобрено: ${approved} | Отказ: ${rejected} | В работе: ${pending}`, icon: '🏦' },
        { label: 'Общая сумма ипотек', value: `$${totalLoan.toLocaleString()}`, subtext: 'Сумма кредитов по всем сделкам', icon: '💰' },
        { label: 'Конверсия одобрений', value: approvalRate, subtext: 'Доля одобренных заявок', icon: '✅' }
      ];
    }

    if (activeReportId === 'RPT-015') {
      let totalFree = activeReportData.length;
      let totalValue = 0;
      let avgPrice = 0;
      activeReportData.forEach(row => {
        totalValue += Number(row['Цена ($)']) || 0;
      });
      avgPrice = totalFree > 0 ? Math.round(totalValue / totalFree) : 0;
      return [
        { label: 'Свободных юнитов', value: totalFree.toString(), subtext: 'В остатках фонда', icon: '🏢' },
        { label: 'Стоимость фонда', value: `$${totalValue.toLocaleString()}`, subtext: 'Суммарный объем Available', icon: '💰' },
        { label: 'Средняя цена лота', value: `$${avgPrice.toLocaleString()}`, subtext: 'В продаже на данный момент', icon: '🏷️' }
      ];
    }

    if (activeReportId === 'RPT-016') {
      let totalSold = activeReportData.length;
      let totalRevenue = 0;
      let totalSqm = 0;
      activeReportData.forEach(row => {
        totalRevenue += Number(row['Цена продажи ($)']) || 0;
        totalSqm += Number(row['Площадь (м²)']) || 0;
      });
      const avgSqmPrice = totalSqm > 0 ? Math.round(totalRevenue / totalSqm) : 0;
      return [
        { label: 'Реализовано юнитов', value: totalSold.toString(), subtext: 'Всего проданных за период', icon: '🏢' },
        { label: 'Общий объем продаж', value: `$${totalRevenue.toLocaleString()}`, subtext: 'Фактическая выручка', icon: '💵' },
        { label: 'Средняя цена за м²', value: `$${avgSqmPrice.toLocaleString()}/м²`, subtext: 'Исходя из общей площади', icon: '📊' }
      ];
    }

    if (activeReportId === 'RPT-017') {
      let totalUnits = 0;
      let soldUnits = 0;
      activeReportData.forEach(row => {
        totalUnits += Number(row['Всего объектов']) || 0;
        soldUnits += Number(row['Продано']) || 0;
      });
      const rate = totalUnits > 0 ? ((soldUnits / totalUnits) * 100).toFixed(1) + '%' : '0.0%';
      return [
        { label: 'Всего объектов', value: totalUnits.toString(), subtext: 'В экспозиции по проектам', icon: '🏢' },
        { label: 'Всего реализовано', value: `${soldUnits} шт.`, subtext: `Доля реализации: ${rate}`, icon: '✅' },
        { label: 'Остаток в продаже', value: (totalUnits - soldUnits).toString(), subtext: 'Свободно или забронировано', icon: '🔑' }
      ];
    }

    if (activeReportId === 'RPT-018') {
      let totalMatched = activeReportData.length;
      let minLotPrice = Infinity;
      let maxLotPrice = -Infinity;
      activeReportData.forEach(row => {
        const price = Number(row['Цена ($)']) || 0;
        if (price < minLotPrice) minLotPrice = price;
        if (price > maxLotPrice) maxLotPrice = price;
      });
      if (totalMatched === 0) {
        minLotPrice = 0;
        maxLotPrice = 0;
      }
      return [
        { label: 'Подобрано вариантов', value: totalMatched.toString(), subtext: 'Соответствуют критериям клиента', icon: '🏢' },
        { label: 'Минимальная стоимость', value: minLotPrice === Infinity ? '$0' : `$${minLotPrice.toLocaleString()}`, subtext: 'Из подходящих вариантов', icon: '📉' },
        { label: 'Максимальная стоимость', value: maxLotPrice === -Infinity ? '$0' : `$${maxLotPrice.toLocaleString()}`, subtext: 'Из подходящих вариантов', icon: '📈' }
      ];
    }

    if (activeReportId === 'RPT-019') {
      let totalChanges = activeReportData.length;
      let totalUp = 0;
      let totalDown = 0;
      activeReportData.forEach(row => {
        const diff = Number(row['Разница ($)']) || 0;
        if (diff > 0) totalUp += diff;
        else if (diff < 0) totalDown += Math.abs(diff);
      });
      return [
        { label: 'Всего изменений', value: totalChanges.toString(), subtext: 'Записей в истории цен', icon: '📝' },
        { label: 'Сумма наценок', value: `+$${totalUp.toLocaleString()}`, subtext: 'Общий прирост стоимости лотов', icon: '📈' },
        { label: 'Сумма уценок', value: `-$${totalDown.toLocaleString()}`, subtext: 'Общее снижение стоимости лотов', icon: '📉' }
      ];
    }

    if (activeReportId === 'RPT-020') {
      let totalUnits = activeReportData.length;
      let discrepancyCount = 0;
      let totalClientDue = 0;
      let totalClientRefund = 0;

      activeReportData.forEach(row => {
        const statusText = row['Статус взаиморасчетов'] || '';
        if (statusText.includes('Требуется доплата')) {
          discrepancyCount++;
          const match = statusText.match(/\$(\d[\d\s,]*)/);
          if (match) {
            totalClientDue += parseInt(match[1].replace(/[\s,]/g, '')) || 0;
          }
        } else if (statusText.includes('Требуется возврат')) {
          discrepancyCount++;
          const match = statusText.match(/\$(\d[\d\s,]*)/);
          if (match) {
            totalClientRefund += parseInt(match[1].replace(/[\s,]/g, '')) || 0;
          }
        }
      });

      return [
        { label: 'Проверено квартир', value: totalUnits.toString(), subtext: `С расхождениями БТИ: ${discrepancyCount}`, icon: '🏢' },
        { label: 'К доплате клиентами', value: `+$${totalClientDue.toLocaleString()}`, subtext: 'Дополнительные соглашения', icon: '📈' },
        { label: 'К возврату клиентам', value: `-$${totalClientRefund.toLocaleString()}`, subtext: 'Переплаты по обмеру БТИ', icon: '📉' }
      ];
    }

    if (activeReportId === 'RPT-013') {
      let totalAmount = 0, success = 0, pending = 0, failed = 0;
      activeReportData.forEach(row => {
        totalAmount += Number(row['Сумма (GEL)']) || 0;
        const status = row['Статус RS.ge'] || '';
        if (status.includes('Успешно')) success++;
        if (status.includes('Ожидает')) pending++;
        if (status.includes('Ошибка')) failed++;
      });
      return [
        { label: 'Всего инвойсов', value: activeReportData.length.toString(), subtext: `✅ ${success} | ⏳ ${pending} | ❌ ${failed}`, icon: '🧾' },
        { label: 'Общая сумма', value: `₾${totalAmount.toLocaleString()}`, subtext: 'По всем выписанным инвойсам', icon: '💴' },
        { label: 'Успешно отправлено', value: `${activeReportData.length > 0 ? ((success / activeReportData.length) * 100).toFixed(0) : 0}%`, subtext: `${success} из ${activeReportData.length} инвойсов`, icon: '✅' },
      ];
    }

    if (activeReportId === 'RPT-014') {
      let totalDeposited = 0, totalReleased = 0, activeCount = 0, releasedCount = 0;
      activeReportData.forEach(row => {
        totalDeposited += Number(row['Депонировано ($)']) || 0;
        totalReleased += Number(row['Раскрыто ($)']) || 0;
        if (row['Статус']?.includes('Активен')) activeCount++;
        if (row['Статус']?.includes('Раскрыт')) releasedCount++;
      });
      const releasePct = totalDeposited > 0
        ? ((totalReleased / totalDeposited) * 100).toFixed(1) + '%'
        : '0%';
      return [
        { label: 'Эскроу счетов', value: activeReportData.length.toString(), subtext: `Активных: ${activeCount} | Раскрытых: ${releasedCount}`, icon: '🏦' },
        { label: 'Депонировано', value: `$${totalDeposited.toLocaleString()}`, subtext: 'Общая сумма на счетах', icon: '💰' },
        { label: 'Раскрыто', value: `$${totalReleased.toLocaleString()}`, subtext: `${releasePct} от общей суммы`, icon: '🔓' },
      ];
    }

    if (activeReportId === 'RPT-021') {
      let totalVip = activeReportData.length;
      let totalSum = 0;
      activeReportData.forEach(row => {
        totalSum += Number(row['Сумма сделок ($)']) || 0;
      });
      const avgSum = totalVip > 0 ? Math.round(totalSum / totalVip) : 0;

      return [
        { label: 'VIP-клиентов', value: totalVip.toString(), subtext: 'В выбранном периоде', icon: '👑' },
        { label: 'Сумма сделок VIP', value: `$${totalSum.toLocaleString()}`, subtext: 'Общий объем бюджетов', icon: '💰' },
        { label: 'Средний объем сделок', value: `$${avgSum.toLocaleString()}`, subtext: 'На одного VIP-клиента', icon: '📊' }
      ];
    }

    if (activeReportId === 'RPT-022') {
      let totalDossiers = activeReportData.length;
      let countWithPhone = 0;
      let sourceCounts: Record<string, number> = {};

      activeReportData.forEach(row => {
        const phone = row['Телефон'] || '';
        if (phone && phone !== '—') {
          countWithPhone++;
        }
        const src = row['Источник'] || 'Не указан';
        sourceCounts[src] = (sourceCounts[src] || 0) + 1;
      });

      let topSource = '—';
      let maxCount = -1;
      Object.entries(sourceCounts).forEach(([src, count]) => {
        if (count > maxCount) {
          maxCount = count;
          topSource = src;
        }
      });

      return [
        { label: 'Всего анкет', value: totalDossiers.toString(), subtext: 'Для обзвонов и рассылок', icon: '📋' },
        { label: 'Контактов с телефонами', value: countWithPhone.toString(), subtext: `Доля: ${totalDossiers > 0 ? ((countWithPhone / totalDossiers) * 100).toFixed(0) + '%' : '0%'}`, icon: '📞' },
        { label: 'Основной источник', value: topSource, subtext: maxCount > 0 ? `Лидов: ${maxCount}` : 'Нет данных', icon: '🔍' }
      ];
    }


    if (activeReportId === 'RPT-023') {
      let totalCalls = 0;
      let totalMeetings = 0;
      let topManager = '—';
      let maxWon = -1;

      // Temporary map to calculate top manager
      const mgrMap: Record<string, number> = {};
      activeReportData.forEach(row => {
        totalCalls += Number(row['Количество звонков']) || 0;
        totalMeetings += Number(row['Количество встреч']) || 0;
        const mgr = row['Менеджер'];
        const won = Number(row['Успешных сделок']) || 0;
        if (mgr && mgr !== 'Не назначен') {
          mgrMap[mgr] = (mgrMap[mgr] || 0) + won;
        }
      });

      Object.entries(mgrMap).forEach(([mgr, won]) => {
        if (won > maxWon) {
          maxWon = won;
          topManager = mgr;
        }
      });

      return [
        { label: 'Всего звонков', value: totalCalls.toString(), subtext: 'Сделано менеджерами', icon: '📞' },
        { label: 'Всего встреч', value: totalMeetings.toString(), subtext: 'Проведено консультаций', icon: '🤝' },
        { label: 'Лидер по продажам', value: topManager, subtext: maxWon > 0 ? `Сделок: ${maxWon}` : 'Нет данных', icon: '🏆' }
      ];
    }

    if (activeReportId === 'RPT-024') {
      let totalBudget = 0;
      let totalRevenue = 0;
      let topChannel = '—';
      let maxDeals = -1;

      activeReportData.forEach(row => {
        totalBudget += Number(row['Маркетинговый бюджет ($)']) || 0;
        totalRevenue += Number(row['Выручка ($)']) || 0;
        const deals = Number(row['Продано']) || 0;
        if (deals > maxDeals) {
          maxDeals = deals;
          topChannel = row['Источник рекламы'] || '—';
        }
      });

      const overallRoi = totalBudget > 0 ? (((totalRevenue - totalBudget) / totalBudget) * 100).toFixed(0) + '%' : '0%';

      return [
        { label: 'Маркетинговый бюджет', value: `${totalBudget.toLocaleString()}`, subtext: 'Суммарные затраты', icon: '💳' },
        { label: 'Общий ROI рекламы', value: overallRoi, subtext: `Выручка: ${totalRevenue.toLocaleString()}`, icon: '📈' },
        { label: 'Лидирующий источник', value: topChannel, subtext: maxDeals > 0 ? `Сделок: ${maxDeals}` : 'Нет данных', icon: '🚀' }
      ];
    }

    if (activeReportId === 'RPT-025') {
      let totalBookings = activeReportData.length;
      let activeBookings = 0;
      let convertedBookings = 0;

      activeBookings = activeReportData.filter(row => row['Статус'] === 'Активна').length;
      // booking-to-contract conversion is simulated or based on deal status
      // We can count non-expired, converted ones
      convertedBookings = activeReportData.filter(row => row['Причина снятия'].includes('Сделка') || row['Статус'] === 'Снята' && !row['Причина снятия'].includes('Истечение')).length;

      const convPct = totalBookings > 0 ? ((convertedBookings / totalBookings) * 100).toFixed(0) + '%' : '0%';

      return [
        { label: 'Всего броней', value: totalBookings.toString(), subtext: 'За выбранный период', icon: '📖' },
        { label: 'Активных броней', value: activeBookings.toString(), subtext: 'Ожидают оплаты/договора', icon: '⏳' },
        { label: 'Конверсия в договор', value: convPct, subtext: 'Доля успешных броней', icon: '📝' }
      ];
    }


    // Дефолтные показатели для некритических отчетов
    return [
      { label: 'Всего записей', value: activeReportData.length.toString(), subtext: 'В текущей таблице', icon: '📊' }
    ];
  }, [activeReportId, activeReportData, funnelViewMode]);

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
        <div className={styles.sidebarTitle}>Каталог отчетов</div>

        {CATEGORIES.map(cat => (
          <div key={cat.id} className={styles.categoryBlock}>
            <div className={styles.categoryHeader}>{cat.name}</div>
            <ul className={styles.reportList}>
              {REPORT_CATALOG.filter(r => r.category === cat.id).map(report => (
                <li
                  key={report.id}
                  className={`${styles.reportItem} ${activeReportId === report.id ? styles.activeReport : ''}`}
                  onClick={() => handleSelectReport(report.id, cat.id)}
                >
                  <div className={styles.reportItemHeader}>
                    <span>{report.name}</span>
                    {report.isCritical && <span className={styles.criticalBadge}>Критич.</span>}
                  </div>
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
              {activeReport.name}
              {!IMPLEMENTED_REPORTS.includes(activeReport.id) && <span className={styles.draftBadge}>Интерактивный макет</span>}
            </h1>
            <p className={styles.reportDescription}>{activeReport.description}</p>
          </div>
          {reportGenerated && activeReportData.length > 0 && (
            <button className={styles.excelBtn} onClick={handleDownloadExcel}>
              Скачать в Excel
            </button>
          )}
        </header>

        {/* Переключатель режима воронки продаж (RPT-001) */}
        {activeReportId === 'RPT-001' && (
          <div className={styles.funnelModeContainer}>
            <button
              type="button"
              className={`${styles.modeTab} ${funnelViewMode === 'pipeline' ? styles.activeModeTab : ''}`}
              onClick={() => setFunnelViewMode('pipeline')}
            >
              Текущие сделки (Pipeline)
            </button>
            <button
              type="button"
              className={`${styles.modeTab} ${funnelViewMode === 'conversion' ? styles.activeModeTab : ''}`}
              onClick={() => setFunnelViewMode('conversion')}
            >
              Исторические переходы (Conversion)
            </button>
          </div>
        )}

        {/* Карточки показателей (KPI Stat Cards) */}
        {reportGenerated && (
          <div className={styles.statsGrid}>
            {reportStats.map((stat, idx) => (
              <div key={idx} className={styles.statCard}>
                <div className={styles.statHeader}>
                  <span className={styles.statLabel}>{stat.label}</span>
                </div>
                <div className={styles.statValue}>{stat.value}</div>
                <div className={styles.statSub}>{stat.subtext}</div>
              </div>
            ))}
          </div>
        )}

        {/* Панель фильтров */}
        <section className={styles.filterBar} style={{ flexWrap: 'wrap', gap: '15px' }}>
          {/* Фильтр по датам (Период) - доступен везде */}
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

          {/* Фильтр ЖК (Project) - доступен везде */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Проект (ЖК)</label>
            <select
              className={styles.filterInput}
              value={selectedProject}
              onChange={e => {
                setSelectedProject(e.target.value);
                setSelectedBlock('ALL'); // сброс корпуса при смене ЖК
              }}
            >
              <option value="ALL">Все ЖК</option>
              {projects.map(proj => (
                <option key={proj.id} value={proj.id}>
                  {proj.name}
                </option>
              ))}
            </select>
          </div>



          {/* Менеджер - RPT-001, RPT-003, RPT-004, RPT-005, RPT-021 */}

          {(activeReportId === 'RPT-001' || activeReportId === 'RPT-003' || activeReportId === 'RPT-004' || activeReportId === 'RPT-005' || activeReportId === 'RPT-021' || activeReportId === 'RPT-023' || activeReportId === 'RPT-025') && (

            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Менеджер</label>
              <select
                className={styles.filterInput}
                value={selectedManager}
                onChange={e => setSelectedManager(e.target.value)}
              >
                <option value="ALL">Все менеджеры</option>
                {managers.map(mgr => (
                  <option key={mgr} value={mgr}>
                    {mgr}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Источник трафика - RPT-001, RPT-007, RPT-022 */}

          {(activeReportId === 'RPT-001' || activeReportId === 'RPT-007' || activeReportId === 'RPT-022' || activeReportId === 'RPT-024') && (

            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Источник</label>
              <select
                className={styles.filterInput}
                value={selectedSource}
                onChange={e => setSelectedSource(e.target.value)}
              >
                <option value="ALL">Все источники</option>
                {sources.map(src => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Канал - RPT-001, RPT-007 */}
          {(activeReportId === 'RPT-001' || activeReportId === 'RPT-007' || activeReportId === 'RPT-024') && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Канал</label>
              <select
                className={styles.filterInput}
                value={selectedChannel}
                onChange={e => setSelectedChannel(e.target.value)}
              >
                <option value="ALL">Все каналы</option>
                {CHANNELS.map(ch => (
                  <option key={ch} value={ch}>
                    {CHANNEL_TRANSLATIONS[ch] || ch}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Тип брони - RPT-025 */}
          {activeReportId === 'RPT-025' && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Тип брони</label>
              <select
                className={styles.filterInput}
                value={selectedBookingType}
                onChange={e => setSelectedBookingType(e.target.value)}
              >
                <option value="ALL">Все типы</option>
                <option value="SOFT">Устная бронь</option>
                <option value="HARD">Платная бронь</option>
              </select>
            </div>
          )}

          {/* Схема оплаты - RPT-001, RPT-004 */}
          {(activeReportId === 'RPT-001' || activeReportId === 'RPT-004') && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Схема оплаты</label>
              <select
                className={styles.filterInput}
                value={selectedPaymentType}
                onChange={e => setSelectedPaymentType(e.target.value)}
              >
                <option value="ALL">Все схемы</option>
                {paymentTypes.map(pt => (
                  <option key={pt} value={pt}>
                    {PAYMENT_TYPE_TRANSLATIONS[pt] || pt}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Тип клиента - RPT-001 */}
          {activeReportId === 'RPT-001' && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Тип клиента</label>
              <select
                className={styles.filterInput}
                value={selectedClientType}
                onChange={e => setSelectedClientType(e.target.value)}
              >
                <option value="ALL">Все типы</option>
                <option value="VIP">VIP клиент</option>
                <option value="REGULAR">Обычный клиент</option>
              </select>
            </div>
          )}

          {/* Корпус - RPT-002, RPT-015, RPT-016, RPT-017, RPT-020 */}
          {(activeReportId === 'RPT-002' || activeReportId === 'RPT-015' || activeReportId === 'RPT-016' || activeReportId === 'RPT-017' || activeReportId === 'RPT-020') && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Корпус</label>
              <select
                className={styles.filterInput}
                value={selectedBlock}
                onChange={e => setSelectedBlock(e.target.value)}
              >
                <option value="ALL">Все корпуса</option>
                {blocks
                  .filter(b => selectedProject === 'ALL' || b.projectId === selectedProject)
                  .map(b => (
                    <option key={b.id} value={b.id}>
                      {b.number}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Тип помещения - RPT-002, RPT-015, RPT-016, RPT-017, RPT-018 */}
          {(activeReportId === 'RPT-002' || activeReportId === 'RPT-015' || activeReportId === 'RPT-016' || activeReportId === 'RPT-017' || activeReportId === 'RPT-018') && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Тип помещения</label>
              <select
                className={styles.filterInput}
                value={selectedUnitType}
                onChange={e => setSelectedUnitType(e.target.value)}
              >
                <option value="ALL">Все типы</option>
                {unitTypes.map(ut => (
                  <option key={ut} value={ut}>
                    {UNIT_TYPE_TRANSLATIONS[ut] || ut}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Фильтр статуса — только RPT-008 */}
          {activeReportId === 'RPT-008' && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Статус оплаты</label>
              <select
                className={styles.filterInput}
                value={selectedPaymentStatus}
                onChange={e => setSelectedPaymentStatus(e.target.value)}
              >
                <option value="ALL">Все статусы</option>
                <option value="PAID">Оплачено</option>
                <option value="OVERDUE">Просрочено</option>
                <option value="PENDING">Ожидается</option>
              </select>
            </div>
          )}

          {/* Фильтры бакета просрочки и менеджера — только RPT-009 */}
          {activeReportId === 'RPT-009' && (
            <>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Срок просрочки</label>
                <select
                  className={styles.filterInput}
                  value={selectedOverdueBucket}
                  onChange={e => setSelectedOverdueBucket(e.target.value)}
                >
                  <option value="ALL">Все сроки</option>
                  <option value="1-30">1–30 дней</option>
                  <option value="30-60">31–60 дней</option>
                  <option value="60-90">61–90 дней</option>
                  <option value="90+">90+ дней</option>
                </select>
              </div>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Менеджер</label>
                <select
                  className={styles.filterInput}
                  value={selectedDebtManager}
                  onChange={e => setSelectedDebtManager(e.target.value)}
                >
                  <option value="ALL">Все менеджеры</option>
                  {Array.from(new Set(initialData.debtors.map((r: any) => r.managerId).filter(Boolean))).map((mgr: any) => (
                    <option key={mgr} value={mgr}>{mgr}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Фильтр схемы оплаты — только RPT-010 */}
          {activeReportId === 'RPT-010' && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Схема оплаты</label>
              <select
                className={styles.filterInput}
                value={selectedCashFlowPaymentType}
                onChange={e => setSelectedCashFlowPaymentType(e.target.value)}
              >
                <option value="ALL">Все схемы</option>
                {paymentTypes.map(pt => (
                  <option key={pt} value={pt}>{PAYMENT_TYPE_TRANSLATIONS[pt] || pt}</option>
                ))}
              </select>
            </div>
          )}

          {/* Фильтры диапазона скидки и менеджера — только RPT-011 */}
          {activeReportId === 'RPT-011' && (
            <>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Диапазон скидки</label>
                <select
                  className={styles.filterInput}
                  value={selectedDiscountRange}
                  onChange={e => setSelectedDiscountRange(e.target.value)}
                >
                  <option value="ALL">Любой %</option>
                  <option value="0-3">до 3%</option>
                  <option value="3-5">3–5%</option>
                  <option value="5-10">5–10%</option>
                  <option value="10+">более 10%</option>
                </select>
              </div>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Менеджер</label>
                <select
                  className={styles.filterInput}
                  value={selectedDiscountManager}
                  onChange={e => setSelectedDiscountManager(e.target.value)}
                >
                  <option value="ALL">Все менеджеры</option>
                  {Array.from(new Set(initialData.discountReport.map((r: any) => r.managerId).filter(Boolean))).map((mgr: any) => (
                    <option key={mgr} value={mgr}>{mgr}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Фильтры банка и статуса заявки — только RPT-012 */}
          {activeReportId === 'RPT-012' && (
            <>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Банк</label>
                <select
                  className={styles.filterInput}
                  value={selectedMortgageBank}
                  onChange={e => setSelectedMortgageBank(e.target.value)}
                >
                  <option value="ALL">Все банки</option>
                  {Array.from(new Set(initialData.mortgageReport.map((r: any) => r.mortgageBank).filter(Boolean))).map((bank: any) => (
                    <option key={bank} value={bank}>{bank}</option>
                  ))}
                </select>
              </div>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Статус заявки</label>
                <select
                  className={styles.filterInput}
                  value={selectedMortgageStatus}
                  onChange={e => setSelectedMortgageStatus(e.target.value)}
                >
                  <option value="ALL">Все статусы</option>
                  <option value="APPROVED">Одобрено</option>
                  <option value="PENDING">На рассмотрении</option>
                  <option value="REJECTED">Отклонено</option>
                </select>
              </div>
            </>
          )}

          {/* Фильтры статуса, инициатора, согласующего — только RPT-005 */}
          {activeReportId === 'RPT-005' && (
            <>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Статус заявки</label>
                <select
                  className={styles.filterInput}
                  value={draftStatusFilter}
                  onChange={e => setDraftStatusFilter(e.target.value)}
                >
                  <option value="ALL">Все статусы</option>
                  <option value="IN_PROGRESS">В работе</option>
                  <option value="APPROVED">Одобрен</option>
                  <option value="REJECTED">Отклонен</option>
                </select>
              </div>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Инициатор</label>
                <select
                  className={styles.filterInput}
                  value={selectedInitiator}
                  onChange={e => setSelectedInitiator(e.target.value)}
                >
                  <option value="ALL">Все инициаторы</option>
                  {initiators.map(init => (
                    <option key={init} value={init}>{init}</option>
                  ))}
                </select>
              </div>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Согласующий</label>
                <select
                  className={styles.filterInput}
                  value={selectedApprover}
                  onChange={e => setSelectedApprover(e.target.value)}
                >
                  <option value="ALL">Все согласующие</option>
                  {approvers.map(appr => (
                    <option key={appr} value={appr}>{appr}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Фильтр группировки по периоду — только RPT-006 */}
          {activeReportId === 'RPT-006' && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Группировка по периоду</label>
              <select
                className={styles.filterInput}
                value={dynamicsInterval}
                onChange={e => setDynamicsInterval(e.target.value)}
              >
                <option value="day">День</option>
                <option value="week">Неделя</option>
                <option value="month">Месяц</option>
                <option value="quarter">Квартал</option>
              </select>
            </div>
          )}

          {/* Фильтр интервала когорты — только RPT-007 */}
          {activeReportId === 'RPT-007' && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Интервал когорты</label>
              <select
                className={styles.filterInput}
                value={cohortInterval}
                onChange={e => setCohortInterval(e.target.value)}
              >
                <option value="week">Неделя</option>
                <option value="month">Месяц</option>
                <option value="quarter">Квартал</option>
              </select>
            </div>
          )}

          {/* Фильтр статуса сделки — только RPT-022 */}
          {activeReportId === 'RPT-022' && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Статус сделки</label>
              <select
                className={styles.filterInput}
                value={dealStatusFilter}
                onChange={e => setDealStatusFilter(e.target.value)}
              >
                <option value="ALL">Все статусы</option>
                {STAGE_ORDER.map(stage => (
                  <option key={stage} value={stage}>
                    {STAGE_TRANSLATIONS[stage] || stage}
                  </option>
                ))}
                <option value="Нет сделки">Нет сделки</option>
              </select>
            </div>
          )}

          {/* Фильтры площади от/до — RPT-015, RPT-016, RPT-018 */}
          {(activeReportId === 'RPT-015' || activeReportId === 'RPT-016' || activeReportId === 'RPT-018') && (
            <>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Площадь от (м²)</label>
                <input
                  type="number"
                  placeholder="Мин"
                  className={styles.filterInput}
                  value={minArea}
                  onChange={e => setMinArea(e.target.value)}
                />
              </div>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Площадь до (м²)</label>
                <input
                  type="number"
                  placeholder="Макс"
                  className={styles.filterInput}
                  value={maxArea}
                  onChange={e => setMaxArea(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Фильтры цены от/до — RPT-015, RPT-018 */}
          {(activeReportId === 'RPT-015' || activeReportId === 'RPT-018') && (
            <>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Цена от ($)</label>
                <input
                  type="number"
                  placeholder="Мин"
                  className={styles.filterInput}
                  value={minPrice}
                  onChange={e => setMinPrice(e.target.value)}
                />
              </div>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Цена до ($)</label>
                <input
                  type="number"
                  placeholder="Макс"
                  className={styles.filterInput}
                  value={maxPrice}
                  onChange={e => setMaxPrice(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Фильтр этажа — RPT-018 */}
          {activeReportId === 'RPT-018' && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Этаж</label>
              <input
                type="number"
                placeholder="Этаж"
                className={styles.filterInput}
                value={filterFloor}
                onChange={e => setFilterFloor(e.target.value)}
              />
            </div>
          )}

          {/* Фильтр вида из окна — RPT-018 */}
          {activeReportId === 'RPT-018' && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Вид из окна</label>
              <select
                className={styles.filterInput}
                value={filterView}
                onChange={e => setFilterView(e.target.value)}
              >
                <option value="ALL">Любой вид</option>
                <option value="Море">Море</option>
                <option value="Горы">Горы</option>
                <option value="Город">Город</option>
                <option value="Двор">Двор</option>
                <option value="Парк">Парк</option>
              </select>
            </div>
          )}

          {/* Фильтр номера квартиры — RPT-019, RPT-020 */}
          {(activeReportId === 'RPT-019' || activeReportId === 'RPT-020') && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Номер квартиры</label>
              <input
                type="text"
                placeholder="Номер"
                className={styles.filterInput}
                value={filterUnitNumber}
                onChange={e => setFilterUnitNumber(e.target.value)}
              />
            </div>
          )}

          {/* Фильтр инициатора — RPT-019 */}
          {activeReportId === 'RPT-019' && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Инициатор</label>
              <select
                className={styles.filterInput}
                value={filterInitiator}
                onChange={e => setFilterInitiator(e.target.value)}
              >
                <option value="ALL">Все инициаторы</option>
                {Array.from(new Set((initialData.priceHistory || []).map((r: any) => r.initiator).filter(Boolean))).map((init: any) => (
                  <option key={init} value={init}>{init}</option>
                ))}
              </select>
            </div>
          )}

          <button className={styles.searchBtn} onClick={() => setReportGenerated(true)}>
            Сформировать
          </button>
        </section>

        {/* Таблица результатов */}
        <section className={styles.tableCard}>
          {!reportGenerated ? (
            <div className={styles.noData}>
              Настройте фильтры и нажмите «Сформировать»
            </div>
          ) : activeReportData.length > 0 ? (
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

                        // Определяем класс ячейки по содержимому
                        let cellClass = '';
                        if (header === 'Статус оплат') {
                          if (val === 'Оплачено') cellClass = styles.statusPaid;
                          else if (val === 'Просрочено') cellClass = styles.statusOverdue;
                          else if (val === 'Ожидается') cellClass = styles.statusPending;
                        } else if (header === 'Статус RS.ge') {
                          if (String(val).includes('Успешно')) cellClass = styles.statusSuccess;
                          else if (String(val).includes('Ошибка')) cellClass = styles.statusFailed;
                          else if (String(val).includes('Ожидает')) cellClass = styles.statusWaiting;
                        } else if (header === 'Статус ипотеки') {
                          if (String(val).includes('Одобрено')) cellClass = styles.statusApproved;
                          else if (String(val).includes('Отклонено')) cellClass = styles.statusRejected;
                          else if (String(val).includes('рассмотрении')) cellClass = styles.statusReview;
                        } else if (header === 'Бакет просрочки') {
                          if (String(val).includes('31–60')) cellClass = styles.bucket30_60;
                          else if (String(val).includes('61–90')) cellClass = styles.bucket60_90;
                          else if (String(val).includes('90+')) cellClass = styles.bucket90plus;
                        }

                        return (
                          <td key={header} className={cellClass || undefined}>
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