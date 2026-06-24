// Обработчики данных для отчётов блока "Объекты, остатки, клиенты" (RPT-015..022)

import { UNIT_TYPE_TRANSLATIONS, LEAD_STATUS_TRANSLATIONS, STAGE_TRANSLATIONS, maskPhone, maskEmail, maskIdNumber } from './reportConstants';

export interface UnitsFilters {
  selectedProject: string;
  selectedBlock: string;
  selectedUnitType: string;
  selectedSource: string;
  dealStatusFilter: string;
  selectedManager: string;
  filterUnitNumber: string;
  filterInitiator: string;
  filterFloor: string;
  filterView: string;
  minArea: string;
  maxArea: string;
  minPrice: string;
  maxPrice: string;
  startDate: string;
  endDate: string;
  blocks: { id: string; number: string; projectId: string }[];
  userRole: string;
}

export function getUnitsReportData(reportId: string, filters: UnitsFilters, initialData: any): any[] {
  const {
    selectedProject, selectedBlock, selectedUnitType, selectedSource, dealStatusFilter,
    selectedManager, filterUnitNumber, filterInitiator, filterFloor, filterView,
    minArea, maxArea, minPrice, maxPrice, startDate, endDate, blocks, userRole
  } = filters;

  switch (reportId) {
    case 'RPT-015': { // Остатки свободных помещений
      const filtered = (initialData.availableUnits || []).filter((row: any) => {
        if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
        if (selectedBlock !== 'ALL' && row.blockNumber !== blocks.find(b => b.id === selectedBlock)?.number) return false;
        if (selectedUnitType !== 'ALL' && row.type !== selectedUnitType) return false;
        if (minArea && row.area < parseFloat(minArea)) return false;
        if (maxArea && row.area > parseFloat(maxArea)) return false;
        if (minPrice && row.price < parseFloat(minPrice)) return false;
        if (maxPrice && row.price > parseFloat(maxPrice)) return false;
        return true;
      });
      return filtered.map((row: any) => ({
        'Квартира': `№${row.unitNumber}`,
        'ЖК': row.projectName,
        'Корпус': row.blockNumber,
        'Тип': UNIT_TYPE_TRANSLATIONS[row.type] || row.type,
        'Площадь (м²)': row.area,
        'Этаж': row.floor,
        'Статус': 'FREE (Свободно)',
        'Цена ($)': Math.round(row.price)
      }));
    }

    case 'RPT-016': { // Реализованные помещения
      const filtered = (initialData.soldUnits || []).filter((row: any) => {
        if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
        if (selectedBlock !== 'ALL' && row.blockId !== selectedBlock) return false;
        if (selectedUnitType !== 'ALL' && row.type !== selectedUnitType) return false;
        if (minArea && row.area < parseFloat(minArea)) return false;
        if (maxArea && row.area > parseFloat(maxArea)) return false;
        if (startDate && row.soldAt && row.soldAt < startDate) return false;
        if (endDate && row.soldAt && row.soldAt > endDate) return false;
        return true;
      });
      return filtered.map((row: any) => ({
        'Квартира': `№${row.unitNumber}`,
        'ЖК': row.projectName,
        'Корпус': row.blockNumber,
        'Тип': UNIT_TYPE_TRANSLATIONS[row.type] || row.type,
        'Площадь (м²)': row.area,
        'Этаж': row.floor,
        'Цена продажи ($)': Math.round(row.soldPrice),
        'Дата продажи': row.soldAt,
        'Цена за м² ($/м²)': Math.round(row.soldPrice / (Number(row.area) || 1))
      }));
    }

    case 'RPT-017': { // Экспозиция объектов
      const filtered = (initialData.projectExposure || []).filter((row: any) => {
        if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
        if (selectedBlock !== 'ALL' && row.blockNumber !== blocks.find(b => b.id === selectedBlock)?.number) return false;
        return true;
      });
      return filtered.map((row: any) => {
        const total = row.totalUnits || 0;
        const sold = row.soldUnits || 0;
        return {
          'ЖК': row.projectName,
          'Корпус': row.blockNumber,
          'Всего объектов': total,
          'Забронировано': row.bookedUnits || 0,
          'Продано': sold,
          'Доля реализации (%)': total > 0 ? ((sold / total) * 100).toFixed(1) + '%' : '0.0%',
          'Остаток фонда': row.freeUnits || 0
        };
      });
    }

    case 'RPT-018': { // Поиск свободных помещений
      const filtered = (initialData.freeUnitsSearch || []).filter((row: any) => {
        if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
        if (selectedUnitType !== 'ALL' && row.type !== selectedUnitType) return false;
        if (minArea && row.area < parseFloat(minArea)) return false;
        if (maxArea && row.area > parseFloat(maxArea)) return false;
        if (minPrice && row.price < parseFloat(minPrice)) return false;
        if (maxPrice && row.price > parseFloat(maxPrice)) return false;
        if (filterFloor && row.floor !== parseInt(filterFloor)) return false;
        if (filterView !== 'ALL' && !row.viewType?.toLowerCase().includes(filterView.toLowerCase())) return false;
        return true;
      });
      return filtered.map((row: any) => ({
        'ЖК': row.projectName,
        'Корпус': row.blockNumber,
        'Номер': `№${row.unitNumber}`,
        'Тип': UNIT_TYPE_TRANSLATIONS[row.type] || row.type,
        'Площадь (м²)': row.area,
        'Цена ($)': Math.round(row.price),
        'Этаж': row.floor,
        'Вид из окна': row.viewType,
        'Комнат': row.rooms,
        'Статус': 'FREE (Свободно)'
      }));
    }

    case 'RPT-019': { // Журнал изменения цен
      const filtered = (initialData.priceHistory || []).filter((row: any) => {
        if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
        if (filterUnitNumber && !row.unitNumber.includes(filterUnitNumber)) return false;
        if (filterInitiator !== 'ALL' && row.initiator !== filterInitiator) return false;
        if (startDate && row.createdAt && row.createdAt < startDate) return false;
        if (endDate && row.createdAt && row.createdAt > endDate) return false;
        return true;
      });
      return filtered.map((row: any) => ({
        'Квартира': `№${row.unitNumber}`,
        'ЖК': row.projectName,
        'Старая цена ($)': Math.round(row.oldPrice),
        'Новая цена ($)': Math.round(row.newPrice),
        'Разница ($)': Math.round(row.newPrice - row.oldPrice),
        'Инициатор': row.initiator,
        'Дата переоценки': row.createdAt,
        'Причина': row.reason
      }));
    }

    case 'RPT-020': { // Отчёт по площадям
      const filtered = (initialData.areaDiscrepancy || []).filter((row: any) => {
        if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
        if (selectedBlock !== 'ALL' && row.blockNumber !== blocks.find(b => b.id === selectedBlock)?.number) return false;
        if (filterUnitNumber && !row.unitNumber.includes(filterUnitNumber)) return false;
        return true;
      });
      return filtered.map((row: any) => {
        const projected = row.projectedArea || 0;
        const actual = row.actualArea || projected;
        const diff = parseFloat((actual - projected).toFixed(2));
        const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
        let compensationStatus = 'Расхождений нет';
        if (diff !== 0) {
          const sqPrice = row.price / (projected || 1);
          const compAmt = Math.round(Math.abs(diff) * sqPrice);
          compensationStatus = diff > 0
            ? `Требуется доплата клиента ($${compAmt.toLocaleString()})`
            : `Требуется возврат клиенту ($${compAmt.toLocaleString()})`;
        }
        return {
          'Квартира': `№${row.unitNumber}`,
          'ЖК': row.projectName,
          'Корпус': row.blockNumber,
          'Проектная площадь (м²)': projected,
          'Фактическая площадь (м²)': actual,
          'Разница (м²)': diffStr,
          'Статус взаиморасчетов': compensationStatus
        };
      });
    }

    case 'RPT-021': { // Реестр VIP-клиентов
      const filtered = (initialData.vipClients || []).filter((row: any) => {
        if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
        if (selectedManager !== 'ALL' && row.managerId !== selectedManager) return false;
        if (startDate && row.firstContact && row.firstContact < startDate) return false;
        if (endDate && row.firstContact && row.firstContact > endDate) return false;
        return true;
      });
      return filtered.map((row: any) => ({
        'ФИО Клиента': row.clientName,
        'Телефон': maskPhone(row.clientPhone, userRole),
        'Email': maskEmail(row.clientEmail, userRole),
        'Активных сделок': row.activeDealsCount,
        'Сумма сделок ($)': Math.round(row.totalDealsAmount),
        'ЖК': row.projectName,
        'Первый контакт': row.firstContact,
        'Последняя активность': row.lastInteraction
      }));
    }

    case 'RPT-022': { // Анкетные данные по клиентам
      const filtered = (initialData.clientDossier || []).filter((row: any) => {
        if (selectedProject !== 'ALL' && row.projectId !== selectedProject) return false;
        if (dealStatusFilter !== 'ALL' && row.dealStatus !== dealStatusFilter) return false;
        if (selectedSource !== 'ALL' && row.source !== selectedSource) return false;
        if (startDate && row.firstTouch && row.firstTouch < startDate) return false;
        if (endDate && row.firstTouch && row.firstTouch > endDate) return false;
        return true;
      });
      return filtered.map((row: any) => ({
        'ФИО Клиента': row.clientName,
        'Телефон': maskPhone(row.clientPhone, userRole),
        'Email': maskEmail(row.clientEmail, userRole),
        'Реквизиты/Документ': maskIdNumber(row.clientIdentity, userRole),
        'Источник': row.source,
        'Статус лида': LEAD_STATUS_TRANSLATIONS[row.leadStatus] || row.leadStatus,
        'Первое касание': row.firstTouch,
        'ЖК': row.projectName,
        'Статус сделки': STAGE_TRANSLATIONS[row.dealStatus] || row.dealStatus
      }));
    }

    default:
      return [];
  }
}