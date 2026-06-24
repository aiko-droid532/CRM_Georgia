// Обработчики данных для отчётов блока "Эффективность" (RPT-023..025)

import { CHANNEL_TRANSLATIONS, getChannelBySource } from './reportConstants';

export interface EfficiencyFilters {
  selectedProject: string;
  selectedManager: string;
  selectedSource: string;
  selectedChannel: string;
  selectedBookingType: string;
  startDate: string;
  endDate: string;
}

export function getEfficiencyReportData(reportId: string, filters: EfficiencyFilters, initialData: any): any[] {
  const { selectedProject, selectedManager, selectedSource, selectedChannel, selectedBookingType, startDate, endDate } = filters;

  switch (reportId) {
    case 'RPT-023': { // Эффективность менеджеров
      const filtered = (initialData.managerKpi || []).filter((row: any) => {
        if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
        if (selectedManager !== 'ALL' && row.managerId !== selectedManager) return false;
        if (startDate && row.createdAt && row.createdAt < startDate) return false;
        if (endDate && row.createdAt && row.createdAt > endDate) return false;
        return true;
      });

      const managersMap: Record<string, any> = {};
      filtered.forEach((row: any) => {
        const mgr = row.managerId;
        if (!managersMap[mgr]) {
          managersMap[mgr] = { calls: 0, meetings: 0, bookings: 0, wonDeals: 0, totalDeals: 0, totalRevenue: 0, cycleTimes: [] };
        }
        if (row.eventType === 'call') managersMap[mgr].calls += 1;
        else if (row.eventType === 'meeting') managersMap[mgr].meetings += 1;
        else if (row.eventType === 'booking') managersMap[mgr].bookings += 1;
        else if (row.eventType === 'deal') {
          managersMap[mgr].totalDeals += 1;
          const isWon = ['SUCCESS', 'PAYMENT_CONFIRMED', 'CONTRACT'].includes(row.status);
          if (isWon) {
            managersMap[mgr].wonDeals += 1;
            managersMap[mgr].totalRevenue += Number(row.totalAmount) || 0;
            if (row.cycleTime && Number(row.cycleTime) > 0) {
              managersMap[mgr].cycleTimes.push(Number(row.cycleTime));
            }
          }
        }
      });

      return Object.entries(managersMap).map(([managerId, stats]) => {
        const conversion = stats.totalDeals > 0 ? parseFloat(((stats.wonDeals / stats.totalDeals) * 100).toFixed(1)) : 0;
        const avgCheck = stats.wonDeals > 0 ? Math.round(stats.totalRevenue / stats.wonDeals) : 0;
        const avgCycle = stats.cycleTimes.length > 0
          ? Math.round(stats.cycleTimes.reduce((a: number, b: number) => a + b, 0) / stats.cycleTimes.length)
          : 0;
        return {
          'Менеджер': managerId,
          'Количество звонков': stats.calls,
          'Количество встреч': stats.meetings,
          'Количество броней': stats.bookings,
          'Всего сделок': stats.totalDeals,
          'Успешных сделок': stats.wonDeals,
          'Конверсия (%)': conversion + '%',
          'Средний чек ($)': avgCheck.toLocaleString(),
          'Ср. цикл сделки (дней)': avgCycle || '—'
        };
      });
    }

    case 'RPT-024': { // Эффективность источников
      const channelsData = initialData.marketingChannels?.channels || [];
      const costsData = initialData.marketingChannels?.costs || [];

      const filtered = channelsData.filter((row: any) => {
        if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
        if (selectedSource !== 'ALL' && row.source !== selectedSource) return false;
        if (selectedChannel !== 'ALL' && getChannelBySource(row.source) !== selectedChannel) return false;
        if (startDate && row.createdAt && row.createdAt < startDate) return false;
        if (endDate && row.createdAt && row.createdAt > endDate) return false;
        return true;
      });

      const filteredCosts = costsData.filter((costRow: any) => {
        if (selectedProject !== 'ALL' && costRow.projectId !== selectedProject) return false;
        if (startDate && costRow.endDate && costRow.endDate < startDate) return false;
        if (endDate && costRow.startDate && costRow.startDate > endDate) return false;
        return true;
      });

      const costsMap: Record<string, number> = {};
      filteredCosts.forEach((costRow: any) => {
        costsMap[costRow.source] = (costsMap[costRow.source] || 0) + (Number(costRow.cost) || 0);
      });

      const channelsMap: Record<string, any> = {};
      filtered.forEach((row: any) => {
        const key = row.source;
        if (!channelsMap[key]) channelsMap[key] = { leads: 0, deals: 0, won: 0, revenue: 0 };
        channelsMap[key].leads += 1;
        if (row.dealId) {
          channelsMap[key].deals += 1;
          if (['SUCCESS', 'PAYMENT_CONFIRMED', 'CONTRACT'].includes(row.dealStatus)) {
            channelsMap[key].won += 1;
            channelsMap[key].revenue += Number(row.price) || 0;
          }
        }
      });

      return Object.entries(channelsMap).map(([source, stats]) => {
        const channelCode = getChannelBySource(source);
        const channelName = CHANNEL_TRANSLATIONS[channelCode] || channelCode;
        const conversion = stats.leads > 0 ? parseFloat(((stats.won / stats.leads) * 100).toFixed(1)) : 0;
        const cost = costsMap[source] || 0;
        const roi = cost > 0 ? (((stats.revenue - cost) / cost) * 100).toFixed(1) + '%' : '—';
        return {
          'Канал связи': channelName,
          'Источник рекламы': source,
          'Привлечено лидов': stats.leads,
          'Создано сделок': stats.deals,
          'Продано': stats.won,
          'Конверсия (%)': conversion + '%',
          'Выручка ($)': Math.round(stats.revenue),
          'Маркетинговый бюджет ($)': cost,
          'ROI (%)': roi
        };
      });
    }

    case 'RPT-025': { // Отчет по броням
      const filtered = (initialData.bookingReport || []).filter((row: any) => {
        if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
        if (selectedManager !== 'ALL' && row.managerId !== selectedManager) return false;
        if (selectedBookingType !== 'ALL' && row.type !== selectedBookingType) return false;
        if (startDate && row.createdAt && row.createdAt < startDate) return false;
        if (endDate && row.createdAt && row.createdAt > endDate) return false;
        return true;
      });

      return filtered.map((row: any) => {
        const cancelReason = row.status === 'EXPIRED' ? 'Истечение срока' : (['CANCELLED', 'RELEASED'].includes(row.status) ? 'Отказ клиента' : '—');
        const bookingType = ['PAID', 'HARD'].includes(row.type) ? 'Платная бронь' : 'Устная бронь';
        const statusText = row.status === 'EXPIRED' ? 'Истекла' : (row.status === 'ACTIVE' ? 'Активна' : 'Снята');
        return {
          'Клиент': row.clientName,
          'Квартира': `№${row.unitNumber}`,
          'ЖК': row.projectName,
          'Дата брони': row.createdAt,
          'Срок действия': row.expiresAt,
          'Тип': bookingType,
          'Статус': statusText,
          'Причина снятия': cancelReason,
          'Сумма депозита ($)': Math.round(row.depositAmount)
        };
      });
    }

    default:
      return [];
  }
}