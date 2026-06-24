// Обработчики данных для отчётов блока "Воронка и продажи" (RPT-001..007)

import {
  STAGE_ORDER, STAGE_TRANSLATIONS, STAGE_PROBABILITIES,
  PAYMENT_TYPE_TRANSLATIONS, getChannelBySource,
  LEAD_STATUS_TRANSLATIONS, STAGE_TRANSLATIONS as STAGE_TR,
  maskPhone, maskEmail, maskIdNumber
} from './reportConstants';

export interface SalesFilters {
  selectedProject: string;
  selectedManager: string;
  selectedSource: string;
  selectedChannel: string;
  selectedPaymentType: string;
  selectedClientType: string;
  selectedBlock: string;
  selectedUnitType: string;
  funnelViewMode: string;
  draftStatusFilter: string;
  dynamicsInterval: string;
  cohortInterval: string;
  dealStatusFilter: string;
  startDate: string;
  endDate: string;
  projects: { id: string; name: string }[];
  blocks: { id: string; number: string; projectId: string }[];
  usdRate: number;
  userRole: string;
}

export function getSalesReportData(reportId: string, filters: SalesFilters, initialData: any): any[] {
  const {
    selectedProject, selectedManager, selectedSource, selectedChannel,
    selectedPaymentType, selectedClientType, selectedBlock, selectedUnitType,
    funnelViewMode, draftStatusFilter, dynamicsInterval, cohortInterval,
    dealStatusFilter, startDate, endDate, projects, blocks, usdRate, userRole
  } = filters;

  switch (reportId) {
    case 'RPT-001': { // Воронка продаж
      const isPipeline = funnelViewMode === 'pipeline';

      if (isPipeline) {
        const filtered = initialData.funnelData.filter((row: any) => {
          if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
          if (selectedManager !== 'ALL' && row.managerId !== selectedManager) return false;
          if (selectedSource !== 'ALL' && row.source !== selectedSource) return false;
          if (selectedChannel !== 'ALL' && getChannelBySource(row.source) !== selectedChannel) return false;
          if (selectedPaymentType !== 'ALL' && row.paymentType !== selectedPaymentType) return false;
          if (selectedClientType !== 'ALL') {
            if (selectedClientType === 'VIP' && !row.isVip) return false;
            if (selectedClientType === 'REGULAR' && row.isVip) return false;
          }
          if (startDate && row.createdAt && row.createdAt < startDate) return false;
          if (endDate && row.createdAt && row.createdAt > endDate) return false;
          return true;
        });

        const stagesMap: Record<string, { count: number; amount: number }> = {};
        STAGE_ORDER.forEach(st => { stagesMap[st] = { count: 0, amount: 0 }; });

        filtered.forEach((row: any) => {
          const stage = row.stage;
          if (stagesMap[stage] !== undefined) {
            stagesMap[stage].count += 1;
            stagesMap[stage].amount += row.amount;
          }
        });

        let prevCount = 0;
        const entryCount = filtered.length;

        return STAGE_ORDER.map((stage, idx) => {
          const stats = stagesMap[stage];
          const name = STAGE_TRANSLATIONS[stage] || stage;
          const amountUsd = stats.amount;
          const amountGel = stats.amount * usdRate;
          const convPrev = prevCount > 0 ? parseFloat(((stats.count / prevCount) * 100).toFixed(1)) : (idx === 0 ? 100 : 0);
          const convEntry = entryCount > 0 ? parseFloat(((stats.count / entryCount) * 100).toFixed(1)) : 0;
          prevCount = stats.count;
          return {
            'Этап воронки': name,
            'Количество сделок': stats.count,
            'Сумма (USD)': Math.round(amountUsd),
            'Сумма (GEL)': Math.round(amountGel),
            'Конверсия от предыд. этапа (%)': convPrev + '%',
            'Конверсия от общего входа (%)': convEntry + '%'
          };
        });
      } else {
        const filteredTransitions = initialData.dealTransitions.filter((row: any) => {
          if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
          if (selectedManager !== 'ALL' && row.managerId !== selectedManager) return false;
          if (selectedSource !== 'ALL' && row.source !== selectedSource) return false;
          if (selectedChannel !== 'ALL' && getChannelBySource(row.source) !== selectedChannel) return false;
          if (selectedPaymentType !== 'ALL' && row.paymentType !== selectedPaymentType) return false;
          if (selectedClientType !== 'ALL') {
            if (selectedClientType === 'VIP' && !row.isVip) return false;
            if (selectedClientType === 'REGULAR' && row.isVip) return false;
          }
          if (startDate && row.createdAt && row.createdAt < startDate) return false;
          if (endDate && row.createdAt && row.createdAt > endDate) return false;
          return true;
        });

        const stagesMap: Record<string, Set<string>> = {};
        const amountsMap: Record<string, number> = {};
        STAGE_ORDER.forEach(st => { stagesMap[st] = new Set<string>(); amountsMap[st] = 0; });

        filteredTransitions.forEach((row: any) => {
          const toStage = row.toStage;
          if (stagesMap[toStage] !== undefined) {
            stagesMap[toStage].add(row.dealId);
            amountsMap[toStage] += row.amount;
          }
        });

        let prevCount = 0;
        const entryCount = filteredTransitions.reduce((acc: Set<string>, row: any) => acc.add(row.dealId), new Set<string>()).size;

        return STAGE_ORDER.map((stage, idx) => {
          const count = stagesMap[stage].size;
          const name = STAGE_TRANSLATIONS[stage] || stage;
          const amountUsd = amountsMap[stage];
          const amountGel = amountUsd * usdRate;
          const convPrev = prevCount > 0 ? parseFloat(((count / prevCount) * 100).toFixed(1)) : (idx === 0 ? 100 : 0);
          const convEntry = entryCount > 0 ? parseFloat(((count / entryCount) * 100).toFixed(1)) : 0;
          prevCount = count;
          return {
            'Этап воронки': name,
            'Уникальных переходов': count,
            'Оборот этапа (USD)': Math.round(amountUsd),
            'Оборот этапа (GEL)': Math.round(amountGel),
            'Конверсия от предыд. этапа (%)': convPrev + '%',
            'Конверсия от входа воронки (%)': convEntry + '%'
          };
        });
      }
    }

    case 'RPT-002': { // План/факт по ЖК
      const filteredSales = initialData.projectSales.filter((row: any) => {
        if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
        if (selectedBlock !== 'ALL' && row.blockId !== selectedBlock) return false;
        if (selectedUnitType !== 'ALL' && row.unitType !== selectedUnitType) return false;
        if (startDate && row.wonAt && row.wonAt < startDate) return false;
        if (endDate && row.wonAt && row.wonAt > endDate) return false;
        return true;
      });

      const projectsMap: Record<string, any> = {};
      filteredSales.forEach((row: any) => {
        if (!projectsMap[row.projectId]) {
          projectsMap[row.projectId] = { projectName: row.projectName, soldUnits: 0, actualRevenue: 0, targetUnits: row.targetUnits || 10, targetRevenue: row.targetRevenue || 1500000, pipelineWeightedRevenue: 0 };
        }
        projectsMap[row.projectId].soldUnits += 1;
        projectsMap[row.projectId].actualRevenue += row.price;
      });

      const activeDeals = initialData.funnelData.filter((row: any) => {
        if (['SUCCESS', 'FAILED', 'CANCELLED'].includes(row.stage)) return false;
        if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
        return true;
      });

      activeDeals.forEach((row: any) => {
        const prob = STAGE_PROBABILITIES[row.stage] || 0;
        const weightedAmount = row.amount * prob;
        const projId = row.projectId;
        if (projectsMap[projId]) {
          projectsMap[projId].pipelineWeightedRevenue += weightedAmount;
        } else {
          const projectObj = projects.find(p => p.id === projId);
          if (projectObj) {
            projectsMap[projId] = { projectName: projectObj.name, soldUnits: 0, actualRevenue: 0, targetUnits: 10, targetRevenue: 1500000, pipelineWeightedRevenue: weightedAmount };
          }
        }
      });

      return Object.values(projectsMap).map(p => {
        const forecast = p.actualRevenue + p.pipelineWeightedRevenue;
        return {
          'Жилой Комплекс': p.projectName,
          'Продано (Юнитов)': p.soldUnits,
          'План (Юнитов)': p.targetUnits,
          'Выполнение по юнитам (%)': ((p.soldUnits / p.targetUnits) * 100).toFixed(1) + '%',
          'Выручка Факт ($)': Math.round(p.actualRevenue),
          'Выручка План ($)': Math.round(p.targetRevenue),
          'Выполнение по выручке (%)': ((p.actualRevenue / p.targetRevenue) * 100).toFixed(1) + '%',
          'Прогноз закрытия периода ($)': Math.round(forecast),
          'Отношение прогноза к плану (%)': ((forecast / p.targetRevenue) * 100).toFixed(1) + '%'
        };
      });
    }

    case 'RPT-003': { // План/факт по менеджерам
      const filteredSales = initialData.managerSales.filter((row: any) => {
        if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
        if (selectedManager !== 'ALL' && row.managerId !== selectedManager) return false;
        if (startDate && row.wonAt && row.wonAt < startDate) return false;
        if (endDate && row.wonAt && row.wonAt > endDate) return false;
        return true;
      });

      const managersMap: Record<string, any> = {};
      filteredSales.forEach((row: any) => {
        const mgr = row.managerId;
        if (!managersMap[mgr]) {
          managersMap[mgr] = { name: mgr, soldUnits: 0, actualRevenue: 0, targetUnits: row.targetUnits || 5, targetRevenue: row.targetRevenue || 750000 };
        }
        managersMap[mgr].soldUnits += 1;
        managersMap[mgr].actualRevenue += row.price;
      });

      return Object.values(managersMap)
        .sort((a, b) => b.actualRevenue - a.actualRevenue)
        .map((m, idx) => ({
          'Рейтинг': idx + 1,
          'Менеджер': m.name,
          'Продано (Юнитов)': m.soldUnits,
          'План (Юнитов)': m.targetUnits,
          'Выполнение (Юниты)': ((m.soldUnits / m.targetUnits) * 100).toFixed(1) + '%',
          'Выручка Факт ($)': Math.round(m.actualRevenue),
          'Выручка План ($)': Math.round(m.targetRevenue),
          'Выполнение (Выручка)': ((m.actualRevenue / m.targetRevenue) * 100).toFixed(1) + '%',
          'Соответствие KPI': m.actualRevenue >= m.targetRevenue ? 'Выполнен' : 'В процессе'
        }));
    }

    case 'RPT-004': { // Сводный отчет по продажам
      const filtered = initialData.cashFlow.filter((row: any) => {
        if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
        if (selectedManager !== 'ALL' && row.managerId !== selectedManager) return false;
        if (selectedPaymentType !== 'ALL' && row.paymentType !== selectedPaymentType) return false;
        if (startDate && row.createdAt && row.createdAt < startDate) return false;
        if (endDate && row.createdAt && row.createdAt > endDate) return false;
        return true;
      });
      return filtered.map((row: any) => ({
        'Сделка': row.dealId.startsWith('test') ? '#Тестовая сделка' : `#${row.dealId.substring(0, 8).toUpperCase()}`,
        'Клиент': row.clientName,
        'Квартира': `№${row.unitNumber}`,
        'Сумма договора ($)': Math.round(row.contractAmount),
        'Поступило оплат ($)': Math.round(row.paidAmount),
        'Ожидается платежей ($)': Math.round(row.pendingAmount),
        'Схема оплаты': PAYMENT_TYPE_TRANSLATIONS[row.paymentType] || row.paymentType || 'Не указана',
        'Менеджер': row.managerId,
        'Дата заключения': row.createdAt
      }));
    }

    case 'RPT-005': { // Реестр заявок на договор
      const filtered = initialData.contractDrafts.filter((row: any) => {
        if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
        if (selectedManager !== 'ALL' && row.managerName !== selectedManager) return false;
        if (startDate && row.draftCreatedAt && row.draftCreatedAt.substring(0, 10) < startDate) return false;
        if (endDate && row.draftCreatedAt && row.draftCreatedAt.substring(0, 10) > endDate) return false;
        let status = 'IN_PROGRESS';
        if (row.draftApprovedAt) status = 'APPROVED';
        else if (['FAILED', 'CANCELLED'].includes(row.currentDealStatus)) status = 'REJECTED';
        if (draftStatusFilter !== 'ALL' && status !== draftStatusFilter) return false;
        return true;
      });
      return filtered.map((row: any) => {
        let status = 'В работе';
        let hours = 0;
        if (row.draftApprovedAt) {
          status = 'Одобрен';
          hours = (new Date(row.draftApprovedAt).getTime() - new Date(row.draftCreatedAt).getTime()) / (1000 * 60 * 60);
        } else if (['FAILED', 'CANCELLED'].includes(row.currentDealStatus)) {
          status = 'Отклонен';
          hours = (Date.now() - new Date(row.draftCreatedAt).getTime()) / (1000 * 60 * 60);
        } else {
          hours = (Date.now() - new Date(row.draftCreatedAt).getTime()) / (1000 * 60 * 60);
        }
        return {
          'Идентификатор': row.dealId.startsWith('test') ? '#Тестовая сделка' : `#${row.dealId.substring(0, 8).toUpperCase()}`,
          'Дата создания': row.draftCreatedAt ? row.draftCreatedAt.substring(0, 10) : '—',
          'Менеджер': row.managerName || 'Не назначен',
          'Клиент': row.clientName || 'Не указан',
          'Проект': row.projectName || '—',
          'Помещение': row.unitNumber ? `№${row.unitNumber}` : '—',
          'Статус': status,
          'Время в работе (ч)': parseFloat(hours.toFixed(1))
        };
      });
    }

    case 'RPT-006': { // Динамика продаж
      const getIntervalKey = (dateStr: string) => {
        if (!dateStr) return 'unknown';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'unknown';
        if (dynamicsInterval === 'day') return dateStr.substring(0, 10);
        if (dynamicsInterval === 'week') {
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          return new Date(d.setDate(diff)).toISOString().substring(0, 10);
        }
        if (dynamicsInterval === 'month') return dateStr.substring(0, 7);
        if (dynamicsInterval === 'quarter') return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
        return dateStr.substring(0, 10);
      };

      const groups: Record<string, any> = {};
      const addToGroup = (key: string) => {
        if (!groups[key]) groups[key] = { leads: 0, visits: 0, applications: 0, bookings: 0, contracts: 0, contractAmount: 0, paymentsAmount: 0 };
      };

      initialData.salesDynamics.leads.forEach((l: any) => {
        if (selectedProject !== 'ALL' && l.projectId !== selectedProject) return;
        if (startDate && l.createdAt && l.createdAt.substring(0, 10) < startDate) return;
        if (endDate && l.createdAt && l.createdAt.substring(0, 10) > endDate) return;
        const key = getIntervalKey(l.createdAt);
        if (key === 'unknown') return;
        addToGroup(key); groups[key].leads += 1;
      });

      initialData.salesDynamics.visits.forEach((v: any) => {
        if (selectedProject !== 'ALL' && v.projectId !== selectedProject) return;
        if (startDate && v.visitedAt && v.visitedAt.substring(0, 10) < startDate) return;
        if (endDate && v.visitedAt && v.visitedAt.substring(0, 10) > endDate) return;
        const key = getIntervalKey(v.visitedAt);
        if (key === 'unknown') return;
        addToGroup(key); groups[key].visits += 1;
      });

      initialData.salesDynamics.applications.forEach((a: any) => {
        if (selectedProject !== 'ALL' && a.projectId !== selectedProject) return;
        if (startDate && a.appliedAt && a.appliedAt.substring(0, 10) < startDate) return;
        if (endDate && a.appliedAt && a.appliedAt.substring(0, 10) > endDate) return;
        const key = getIntervalKey(a.appliedAt);
        if (key === 'unknown') return;
        addToGroup(key); groups[key].applications += 1;
      });

      initialData.salesDynamics.bookings.forEach((b: any) => {
        if (selectedProject !== 'ALL' && b.projectId !== selectedProject) return;
        if (startDate && b.createdAt && b.createdAt.substring(0, 10) < startDate) return;
        if (endDate && b.createdAt && b.createdAt.substring(0, 10) > endDate) return;
        const key = getIntervalKey(b.createdAt);
        if (key === 'unknown') return;
        addToGroup(key); groups[key].bookings += 1;
      });

      initialData.salesDynamics.contracts.forEach((c: any) => {
        if (selectedProject !== 'ALL' && c.projectId !== selectedProject) return;
        if (startDate && c.signedAt && c.signedAt.substring(0, 10) < startDate) return;
        if (endDate && c.signedAt && c.signedAt.substring(0, 10) > endDate) return;
        const key = getIntervalKey(c.signedAt);
        if (key === 'unknown') return;
        addToGroup(key); groups[key].contracts += 1; groups[key].contractAmount += c.amount;
      });

      initialData.salesDynamics.payments.forEach((p: any) => {
        if (selectedProject !== 'ALL' && p.projectId !== selectedProject) return;
        if (startDate && p.paidAt && p.paidAt.substring(0, 10) < startDate) return;
        if (endDate && p.paidAt && p.paidAt.substring(0, 10) > endDate) return;
        const key = getIntervalKey(p.paidAt);
        if (key === 'unknown') return;
        addToGroup(key); groups[key].paymentsAmount += p.paidAmount;
      });

      const monthNames = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
      const formatPeriodLabel = (key: string) => {
        if (dynamicsInterval === 'month') { const [y, m] = key.split('-'); return `${monthNames[parseInt(m)]} ${y}`; }
        if (dynamicsInterval === 'week') return `Неделя с ${key}`;
        if (dynamicsInterval === 'quarter') { const [y, q] = key.split('-'); return `${q.replace('Q', '')} кв. ${y}`; }
        return key;
      };

      return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([key, data]) => ({
        'Период': formatPeriodLabel(key),
        'Лиды': data.leads,
        'Посещения': data.visits,
        'Заявки': data.applications,
        'Брони': data.bookings,
        'Договоры': data.contracts,
        'Сумма договоров ($)': Math.round(data.contractAmount),
        'Поступило оплат ($)': Math.round(data.paymentsAmount)
      }));
    }

    case 'RPT-007': { // Когортный анализ клиентов
      const getCohortKey = (dateStr: string) => {
        if (!dateStr) return 'unknown';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'unknown';
        if (cohortInterval === 'week') {
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          return new Date(d.setDate(diff)).toISOString().substring(0, 10);
        }
        if (cohortInterval === 'month') return dateStr.substring(0, 7);
        if (cohortInterval === 'quarter') return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
        return dateStr.substring(0, 7);
      };

      const cohorts: Record<string, any> = {};
      initialData.cohortAnalysis.forEach((row: any) => {
        if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return;
        if (startDate && row.leadCreatedAt && row.leadCreatedAt.substring(0, 10) < startDate) return;
        if (endDate && row.leadCreatedAt && row.leadCreatedAt.substring(0, 10) > endDate) return;
        if (selectedSource !== 'ALL' && row.source !== selectedSource) return;
        if (selectedChannel !== 'ALL' && getChannelBySource(row.source) !== selectedChannel) return;
        const key = getCohortKey(row.leadCreatedAt);
        if (key === 'unknown') return;
        if (!cohorts[key]) cohorts[key] = { totalLeads: 0, wonDeals: 0, totalRevenue: 0, totalCycleDays: 0 };
        cohorts[key].totalLeads += 1;
        if (['SUCCESS', 'PAYMENT_CONFIRMED'].includes(row.dealStatus)) {
          cohorts[key].wonDeals += 1;
          cohorts[key].totalRevenue += row.price || 0;
          if (row.leadCreatedAt && row.dealUpdatedAt) {
            const diff = Math.max(0, (new Date(row.dealUpdatedAt).getTime() - new Date(row.leadCreatedAt).getTime()) / (1000 * 60 * 60 * 24));
            cohorts[key].totalCycleDays += diff;
          }
        }
      });

      const monthNames = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
      const formatCohortLabel = (key: string) => {
        if (cohortInterval === 'month') { const [y, m] = key.split('-'); return `${monthNames[parseInt(m)]} ${y}`; }
        if (cohortInterval === 'week') return `Неделя с ${key}`;
        if (cohortInterval === 'quarter') { const [y, q] = key.split('-'); return `${q.replace('Q', '')} кв. ${y}`; }
        return key;
      };

      return Object.entries(cohorts).sort(([a], [b]) => a.localeCompare(b)).map(([key, data]) => ({
        'Когорта': formatCohortLabel(key),
        'Клиентов в когорте': data.totalLeads,
        'Средний чек ($)': data.wonDeals > 0 ? Math.round(data.totalRevenue / data.wonDeals) : 0,
        'Конверсия в Won': data.totalLeads > 0 ? ((data.wonDeals / data.totalLeads) * 100).toFixed(1) + '%' : '0.0%',
        'Ср. цикл сделки (дн)': data.wonDeals > 0 ? Math.round(data.totalCycleDays / data.wonDeals) : 0
      }));
    }

    default:
      return [];
  }
}