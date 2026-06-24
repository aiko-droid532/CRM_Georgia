// Обработчики данных для отчётов блока "Финансы" (RPT-008..014)

import { PAYMENT_TYPE_TRANSLATIONS } from './reportConstants';

export interface FinanceFilters {
  selectedProject: string;
  selectedManager: string;
  selectedPaymentStatus: string;
  selectedOverdueBucket: string;
  selectedDebtManager: string;
  selectedCashFlowPaymentType: string;
  selectedDiscountRange: string;
  selectedDiscountManager: string;
  selectedMortgageBank: string;
  selectedMortgageStatus: string;
  startDate: string;
  endDate: string;
}

export function getFinanceReportData(reportId: string, filters: FinanceFilters, initialData: any): any[] {
  const {
    selectedProject, selectedManager,
    selectedPaymentStatus, selectedOverdueBucket, selectedDebtManager,
    selectedCashFlowPaymentType, selectedDiscountRange, selectedDiscountManager,
    selectedMortgageBank, selectedMortgageStatus,
    startDate, endDate
  } = filters;

  switch (reportId) {
    case 'RPT-008': { // Реестр платежей
      const filtered = initialData.paymentRegistry.filter((row: any) => {
        if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
        if (startDate && row.dueDate < startDate) return false;
        if (endDate && row.dueDate > endDate) return false;
        if (selectedPaymentStatus !== 'ALL' && row.paymentStatus !== selectedPaymentStatus) return false;
        return true;
      });
      return filtered.map((row: any) => ({
        'Сделка': `#${row.dealId.substring(0, 8).toUpperCase()}`,
        'Клиент': row.clientName,
        'Квартира': `№${row.unitNumber}`,
        'Сумма к оплате ($)': Math.round(row.scheduledAmount),
        'Срок оплаты': row.dueDate,
        'Оплачено факт ($)': Math.round(row.paidAmount),
        'Статус оплат': row.paymentStatus === 'PAID' ? 'Оплачено' : row.paymentStatus === 'OVERDUE' ? 'Просрочено' : 'Ожидается'
      }));
    }

    case 'RPT-009': { // Реестр дебиторской задолженности
      const filtered = initialData.debtors.filter((row: any) => {
        if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
        if (startDate && row.dueDate < startDate) return false;
        if (endDate && row.dueDate > endDate) return false;
        if (selectedDebtManager !== 'ALL' && row.managerId !== selectedDebtManager) return false;
        if (selectedOverdueBucket !== 'ALL') {
          const d = row.daysOverdue;
          if (selectedOverdueBucket === '1-30' && !(d >= 1 && d <= 30)) return false;
          if (selectedOverdueBucket === '30-60' && !(d > 30 && d <= 60)) return false;
          if (selectedOverdueBucket === '60-90' && !(d > 60 && d <= 90)) return false;
          if (selectedOverdueBucket === '90+' && !(d > 90)) return false;
        }
        return true;
      });
      return filtered.map((row: any) => {
        const d = row.daysOverdue;
        const bucket = d <= 30 ? '1–30 дней' : d <= 60 ? '31–60 дней' : d <= 90 ? '61–90 дней' : '90+ дней';
        return {
          'Сделка': `#${row.dealId.substring(0, 8).toUpperCase()}`,
          'Клиент': row.clientName,
          'Телефон': row.clientPhone,
          'Квартира': `№${row.unitNumber}`,
          'Менеджер': row.managerId,
          'Сумма долга ($)': Math.round(row.overdueAmount),
          'Срок платежа': row.dueDate,
          'Дней просрочки': row.daysOverdue,
          'Бакет просрочки': bucket,
          'Начислено пени ($)': Math.round(row.penalty),
          'Итого к оплате ($)': Math.round(row.totalDebt)
        };
      });
    }

    case 'RPT-010': { // Сводный денежный поток
      const filtered = initialData.cashFlowReport.filter((row: any) => {
        if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
        if (selectedCashFlowPaymentType !== 'ALL' && row.paymentType !== selectedCashFlowPaymentType) return false;
        if (startDate && row.month < startDate.substring(0, 7)) return false;
        if (endDate && row.month > endDate.substring(0, 7)) return false;
        return true;
      });

      const byMonth: Record<string, { scheduled: number; paid: number }> = {};
      filtered.forEach((row: any) => {
        if (!byMonth[row.month]) byMonth[row.month] = { scheduled: 0, paid: 0 };
        byMonth[row.month].scheduled += row.scheduledAmount;
        byMonth[row.month].paid += row.paidAmount;
      });

      const monthNames = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
      return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, data]) => {
        const isPast = month <= new Date().toISOString().substring(0, 7);
        const deviation = isPast ? Math.round(data.paid - data.scheduled) : null;
        const execution = isPast && data.scheduled > 0 ? ((data.paid / data.scheduled) * 100).toFixed(1) + '%' : '—';
        const [year, mon] = month.split('-');
        return {
          'Месяц': `${monthNames[parseInt(mon)]} ${year}`,
          ...(selectedCashFlowPaymentType !== 'ALL' ? { 'Схема оплаты': PAYMENT_TYPE_TRANSLATIONS[selectedCashFlowPaymentType] || selectedCashFlowPaymentType } : {}),
          'Прогноз / план ($)': Math.round(data.scheduled),
          'Фактически получено ($)': isPast ? Math.round(data.paid) : null,
          'Отклонение ($)': deviation,
          'Исполнение': execution
        };
      });
    }

    case 'RPT-011': { // Отчет по индивидуальным скидкам
      const filtered = initialData.discountReport.filter((row: any) => {
        if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
        if (selectedDiscountManager !== 'ALL' && row.managerId !== selectedDiscountManager) return false;
        if (startDate && row.createdAt && row.createdAt < startDate) return false;
        if (endDate && row.createdAt && row.createdAt > endDate) return false;
        if (selectedDiscountRange !== 'ALL') {
          const pct = row.discountPct;
          if (selectedDiscountRange === '0-3' && !(pct >= 0 && pct <= 3)) return false;
          if (selectedDiscountRange === '3-5' && !(pct > 3 && pct <= 5)) return false;
          if (selectedDiscountRange === '5-10' && !(pct > 5 && pct <= 10)) return false;
          if (selectedDiscountRange === '10+' && !(pct > 10)) return false;
        }
        return true;
      });
      return filtered.map((row: any) => ({
        'Сделка': row.dealId.startsWith('test') ? '#Тестовая сделка' : `#${row.dealId.substring(0, 8).toUpperCase()}`,
        'Клиент': row.clientName,
        'Квартира': `№${row.unitNumber}`,
        'Менеджер': row.managerId,
        'Базовая цена ($)': Math.round(row.basePrice),
        'Индивидуальная скидка (%)': `${row.discountPct}%`,
        'Сумма скидки ($)': Math.round(row.discountAmount),
        'Цена со скидкой ($)': Math.round(row.finalPrice),
        'Дата сделки': row.createdAt
      }));
    }

    case 'RPT-012': { // Отчет по ипотечным сделкам
      const filtered = initialData.mortgageReport.filter((row: any) => {
        if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
        if (selectedManager !== 'ALL' && row.managerId !== selectedManager) return false;
        if (selectedMortgageBank !== 'ALL' && row.mortgageBank !== selectedMortgageBank) return false;
        if (selectedMortgageStatus !== 'ALL' && row.mortgageStatus !== selectedMortgageStatus) return false;
        if (startDate && row.createdAt && row.createdAt < startDate) return false;
        if (endDate && row.createdAt && row.createdAt > endDate) return false;
        return true;
      });
      return filtered.map((row: any) => ({
        'Сделка': row.dealId.startsWith('test') ? '#Тестовая сделка' : `#${row.dealId.substring(0, 8).toUpperCase()}`,
        'Клиент': row.clientName,
        'Телефон': row.clientPhone,
        'Квартира': `№${row.unitNumber}`,
        'Цена квартиры ($)': Math.round(row.unitPrice),
        'Банк': row.mortgageBank,
        'Сумма кредита ($)': Math.round(row.loanAmount),
        'Первоначальный взнос ($)': Math.round(row.downPayment),
        'Статус ипотеки': row.mortgageStatus === 'APPROVED' ? 'Одобрено' : row.mortgageStatus === 'REJECTED' ? 'Отклонено' : 'На рассмотрении',
        'Комментарий': row.mortgageComment
      }));
    }

    case 'RPT-013': { // Отчёт по e-invoice
      const invoiceStatusLabels: Record<string, string> = {
        'SUCCESS': '✅ Успешно отправлен',
        'PENDING': '⏳ Ожидает отправки',
        'FAILED': '❌ Ошибка отправки',
      };
      const filtered = initialData.taxInvoiceReport.filter((row: any) => {
        if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
        if (startDate && row.issuedAt < startDate) return false;
        if (endDate && row.issuedAt > endDate) return false;
        return true;
      });
      return filtered.map((row: any) => ({
        'Номер инвойса': row.invoiceNumber,
        'Сделка': row.dealId.startsWith('test') ? '#ТЕСТ' : `#${row.dealId.substring(0, 8).toUpperCase()}`,
        'Клиент': row.clientName,
        'Квартира': `№${row.unitNumber}`,
        'Сумма (GEL)': Math.round(row.amount),
        'Валюта': row.currency,
        'Дата выписки': row.issuedAt,
        'Статус RS.ge': invoiceStatusLabels[row.status] || row.status,
      }));
    }

    case 'RPT-014': { // Отчёт по эскроу
      const escrowStatusLabels: Record<string, string> = {
        'ACTIVE': '🔒 Активен',
        'RELEASED': '✅ Раскрыт',
        'CLOSED': '📁 Закрыт',
      };
      const filtered = initialData.escrowReport.filter((row: any) => {
        if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
        if (startDate && row.createdAt < startDate) return false;
        if (endDate && row.createdAt > endDate) return false;
        return true;
      });
      return filtered.map((row: any) => {
        const releasePct = row.depositedAmount > 0 ? ((row.releasedAmount / row.depositedAmount) * 100).toFixed(1) + '%' : '0%';
        return {
          'Сделка': row.dealId.startsWith('test') ? '#ТЕСТ' : `#${row.dealId.substring(0, 8).toUpperCase()}`,
          'Клиент': row.clientName,
          'Квартира': `№${row.unitNumber}`,
          'Банк-депозитарий': row.bankName,
          'Депонировано ($)': Math.round(row.depositedAmount),
          'Раскрыто ($)': Math.round(row.releasedAmount),
          'Остаток ($)': Math.round(row.remainingAmount),
          'Раскрыто (%)': releasePct,
          'Этап раскрытия': row.releaseStage,
          'Статус': escrowStatusLabels[row.status] || row.status,
        };
      });
    }

    default:
      return [];
  }
}