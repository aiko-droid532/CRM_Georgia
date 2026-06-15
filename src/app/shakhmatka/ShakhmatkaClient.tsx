'use client';
 
import React, { useState, useEffect, useMemo } from 'react';
import styles from './Shakhmatka.module.css';
import { createDemoProject, massUpdatePrices, getPriceHistory, createUnit, updateUnit, deleteUnit, getBlocksForSelect } from '@/app/actions/units';
import { createBooking } from '@/app/actions/booking';
import { getExchangeRate } from '@/app/actions/exchange';
import { importUnitsFromExcel } from '@/app/actions/import';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

interface ShakhmatkaClientProps {
  projects: any[];
  leads: any[];
  organizationId: string;
  userRole?: string;
}
 
export default function ShakhmatkaClient({ projects: initialProjects, leads, organizationId, userRole = 'manager' }: ShakhmatkaClientProps) {
  // Данные и фильтры
  const [projects, setProjects] = useState(initialProjects);
  const [activeProjectId, setActiveProjectId] = useState(projects[0]?.id || null);
  const [activeBlockId, setActiveBlockId] = useState(projects[0]?.blocks?.[0]?.id || null);
  
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [roomsFilter, setRoomsFilter] = useState('ALL');
  const [priceFilter, setPriceFilter] = useState({ min: '', max: '' });
  const [areaFilter, setAreaFilter] = useState({ min: '', max: '' });

  // Состояния для массового изменения цен (CAT-007)
  const [showMassPanel, setShowMassPanel] = useState(false);
  const [massBlockId, setMassBlockId] = useState('');
  const [massRooms, setMassRooms] = useState('ALL');
  const [massChangeType, setMassChangeType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [massChangeValue, setMassChangeValue] = useState(0);
  const [massReason, setMassReason] = useState('');
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
 
  // UI Состояния
  const [selectedUnit, setSelectedUnit] = useState<any>(null);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [loading, setLoading] = useState(false);
  const [exchangeRate, setExchangeRate] = useState('2.70');
  const [rateLoading, setRateLoading] = useState(true);
  
  // Состояния для импорта Excel
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);

  // Состояния для CAT-004 (CRUD)
  const [showCreateUnitModal, setShowCreateUnitModal] = useState(false);
  const [showEditUnitModal, setShowEditUnitModal] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState('');
  const [blocksList, setBlocksList] = useState<any[]>([]);
  const [editUnitData, setEditUnitData] = useState({
    number: '',
    floor: '',
    area: '',
    rooms: '',
    price: '',
    type: 'Apartment',
    viewType: '',
    livingArea: ''
  });

  const router = useRouter();

  // Загрузка курса валют
  useEffect(() => {
    async function loadExchangeRate() {
      try {
        setRateLoading(true);
        const rate = await getExchangeRate();
        setExchangeRate(rate.toString());
      } catch (error) {
        console.error('Failed to load exchange rate:', error);
        setExchangeRate('2.70');
      } finally {
        setRateLoading(false);
      }
    }
    loadExchangeRate();
  }, []);

  // Загрузка списка блоков для CRUD
  useEffect(() => {
    async function loadBlocks() {
      const blocks = await getBlocksForSelect(organizationId);
      setBlocksList(blocks);
    }
    loadBlocks();
  }, [organizationId]);

  // Калькулятор
  const [downPayment, setDownPayment] = useState(0);
  const [months, setMonths] = useState(12);
  const [monthlyPayment, setMonthlyPayment] = useState(0);

  // Состояния для бронирования (SOFT, HARD, SERVICE)
  const [bookingType, setBookingType] = useState<'SOFT' | 'HARD' | 'SERVICE'>('SOFT');
  const [softDuration, setSoftDuration] = useState('1'); // hours
  const [hardDuration, setHardDuration] = useState('14'); // days

  // SSE (Real-time обновления)
  useEffect(() => {
    const eventSource = new EventSource('/api/stream');

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'STATUS_CHANGED') {
        setProjects(prevProjects => {
          const newProjects = [...prevProjects];
          for (let p of newProjects) {
            for (let b of p.blocks || []) {
              const unit = b.units?.find((u: any) => u.id === data.unitId);
              if (unit) {
                unit.status = data.newStatus;
                unit.version = (unit.version || 0) + 1;
              }
            }
          }
          return newProjects;
        });
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    if (selectedUnit) {
      const remaining = selectedUnit.price - downPayment;
      setMonthlyPayment(Math.max(0, Math.round(remaining / months)));
    }
  }, [downPayment, months, selectedUnit]);

  // Обработка клика по квартире
  const handleUnitClick = (unit: any) => {
    setSelectedUnit(unit);
    setPriceHistory([]);
    setDownPayment(Math.round(unit.price * 0.3));
    if (leads.length > 0) setSelectedLeadId(leads[0].id);
    setBookingType('SOFT');
    setSoftDuration('1');
    setHardDuration('14');
  };

  // Закрыть side-panel
  const closePanel = () => {
    setSelectedUnit(null);
    setPriceHistory([]);
  };

  // Загрузка истории цен квартиры (CAT-006)
  const loadUnitPriceHistory = async () => {
    if (!selectedUnit) return;
    const history = await getPriceHistory(selectedUnit.id);
    setPriceHistory(history);
  };

  // ========== CAT-004: CRUD операции ==========
  
  // Создание квартиры
  const handleCreateUnit = async () => {
    if (!selectedBlockId) {
      alert('Выберите корпус');
      return;
    }
    
    const unitData = {
      number: editUnitData.number,
      floor: parseInt(editUnitData.floor),
      area: parseFloat(editUnitData.area),
      rooms: parseInt(editUnitData.rooms),
      price: parseFloat(editUnitData.price),
      type: editUnitData.type,
      viewType: editUnitData.viewType || undefined,
      livingArea: editUnitData.livingArea ? parseFloat(editUnitData.livingArea) : undefined,
      blockId: selectedBlockId,
      organizationId,
      createdById: organizationId
    };
    
    if (!unitData.number || !unitData.floor || !unitData.area || !unitData.rooms || !unitData.price) {
      alert('Заполните все обязательные поля');
      return;
    }
    
    setLoading(true);
    const res = await createUnit(unitData);
    if (res.success) {
      alert('✅ Квартира успешно создана');
      setShowCreateUnitModal(false);
      setEditUnitData({ number: '', floor: '', area: '', rooms: '', price: '', type: 'Apartment', viewType: '', livingArea: '' });
      router.refresh();
    } else {
      alert('❌ Ошибка: ' + res.error);
    }
    setLoading(false);
  };

  // Обновление квартиры
  const handleUpdateUnit = async () => {
    const reason = prompt('Укажите причину изменения:', 'Редактирование карточки квартиры');
    if (!reason) return;
    
    const updates: any = { unitId: selectedUnit.id, reason, organizationId, initiatorId: organizationId };
    
    if (editUnitData.number && editUnitData.number !== selectedUnit.number.toString()) updates.number = editUnitData.number;
    if (editUnitData.floor && parseInt(editUnitData.floor) !== selectedUnit.floor) updates.floor = parseInt(editUnitData.floor);
    if (editUnitData.area && parseFloat(editUnitData.area) !== selectedUnit.area) updates.area = parseFloat(editUnitData.area);
    if (editUnitData.rooms && parseInt(editUnitData.rooms) !== selectedUnit.rooms) updates.rooms = parseInt(editUnitData.rooms);
    if (editUnitData.price && parseFloat(editUnitData.price) !== selectedUnit.price) updates.price = parseFloat(editUnitData.price);
    if (editUnitData.type !== selectedUnit.type) updates.type = editUnitData.type;
    if (editUnitData.viewType !== (selectedUnit.viewType || '')) updates.viewType = editUnitData.viewType || null;
    if (editUnitData.livingArea && parseFloat(editUnitData.livingArea) !== (selectedUnit.livingArea || 0)) updates.livingArea = parseFloat(editUnitData.livingArea);
    
    setLoading(true);
    const res = await updateUnit(updates);
    if (res.success) {
      alert(`✅ Квартира обновлена\nИзменения: ${res.changes?.join(', ')}`);
      setShowEditUnitModal(false);
      router.refresh();
      closePanel();
    } else {
      alert('❌ Ошибка: ' + res.error);
    }
    setLoading(false);
  };

  // Удаление квартиры (мягкое)
  const handleDeleteUnit = async () => {
    const reason = prompt('Укажите причину исключения квартиры из продаж:', 'Исключена из плана продаж');
    if (!reason) return;
    
    const confirmed = confirm('ВНИМАНИЕ! Квартира будет исключена из продаж (статус EXCLUDED). Это действие нельзя отменить через интерфейс. Продолжить?');
    if (!confirmed) return;
    
    setLoading(true);
    const res = await deleteUnit(selectedUnit.id, reason, organizationId, organizationId);
    if (res.success) {
      alert('✅ Квартира исключена из продаж');
      closePanel();
      router.refresh();
    } else {
      alert('❌ Ошибка: ' + res.error);
    }
    setLoading(false);
  };

  // Открытие формы редактирования
  const openEditModal = () => {
    setEditUnitData({
      number: selectedUnit.number.toString(),
      floor: selectedUnit.floor.toString(),
      area: selectedUnit.area.toString(),
      rooms: selectedUnit.rooms.toString(),
      price: selectedUnit.price.toString(),
      type: selectedUnit.type || 'Apartment',
      viewType: selectedUnit.viewType || '',
      livingArea: selectedUnit.livingArea?.toString() || ''
    });
    setShowEditUnitModal(true);
  };

  // ========== Массовое изменение цен ==========
  const handleMassUpdate = async () => {
    if (!activeProjectId) return;
    if (!massReason) {
      alert('Укажите причину изменения цен!');
      return;
    }
    
    const valText = massChangeType === 'PERCENT' ? `${massChangeValue}%` : `$${massChangeValue}`;
    const confirmed = confirm(`Вы действительно хотите изменить цены на величину ${valText}? Это действие запишется в PriceHistory.`);
    if (!confirmed) return;

    setLoading(true);
    const res = await massUpdatePrices({
      projectId: activeProjectId,
      blockId: massBlockId || undefined,
      rooms: massRooms,
      changeType: massChangeType,
      changeValue: massChangeValue,
      reason: massReason,
      organizationId,
      initiatorId: organizationId
    });

    if (res.success) {
      alert('Массовое изменение цен успешно выполнено!');
      setShowMassPanel(false);
      setMassReason('');
      setMassChangeValue(0);
      
      setProjects(prevProjects => {
        const newProjects = [...prevProjects];
        for (let p of newProjects) {
          if (p.id === activeProjectId) {
            for (let b of p.blocks || []) {
              if (!massBlockId || b.id === massBlockId) {
                for (let u of b.units || []) {
                  if (u.status !== 'SOLD' && (massRooms === 'ALL' || u.rooms?.toString() === massRooms)) {
                    let newPrice = u.price;
                    if (massChangeType === 'PERCENT') {
                      newPrice = Math.round(u.price * (1 + massChangeValue / 100));
                    } else {
                      newPrice = u.price + massChangeValue;
                    }
                    u.price = Math.max(0, newPrice);
                    u.version = (u.version || 0) + 1;
                  }
                }
              }
            }
          }
        }
        return newProjects;
      });
      
      router.refresh();
    } else {
      alert('Ошибка при массовом обновлении цен: ' + (res.message || 'Неизвестная ошибка'));
    }
    setLoading(false);
  };

  // ========== Импорт из Excel ==========
  const handleImport = async () => {
    if (!importFile) {
      alert('Выберите файл Excel');
      return;
    }
    
    setLoading(true);
    setImportResult(null);
    const formData = new FormData();
    formData.append('file', importFile);
    
    const res = await importUnitsFromExcel(formData, organizationId, organizationId);
    
    if (res.success) {
      alert(`✅ Импорт завершен!\n➕ Добавлено: ${res.imported}\n🔄 Обновлено: ${res.updated}\n📊 Всего строк: ${res.total}\n${res.errors ? `⚠️ Ошибок: ${res.errors.length}` : ''}`);
      router.refresh();
      setShowImportModal(false);
      setImportFile(null);
      setImportResult(null);
    } else {
      alert('❌ Ошибка импорта: ' + res.error);
      setImportResult(res);
    }
    setLoading(false);
  };

  // Скачивание шаблона Excel
  const downloadTemplate = () => {
    try {
      const template = [
        { projectName: 'ЖК "Астана Тауэр"', blockNumber: 'А', floor: 1, number: '101', area: 45.5, rooms: 1, price: 18000000, type: 'Apartment', viewType: 'На город', address: 'пр. Мангилик Ел, 25' },
        { projectName: 'ЖК "Астана Тауэр"', blockNumber: 'А', floor: 1, number: '102', area: 65.2, rooms: 2, price: 25000000, type: 'Apartment', viewType: 'Во двор', address: 'пр. Мангилик Ел, 25' }
      ];
      const worksheet = XLSX.utils.json_to_sheet(template);
      worksheet['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 25 }];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
      XLSX.writeFile(workbook, 'import_template.xlsx');
    } catch (error) {
      console.error('Error downloading template:', error);
      alert('Ошибка при скачивании шаблона');
    }
  };

  // Бронирование
  const onBook = async () => {
    if (!selectedLeadId) return alert('Выберите клиента!');
    setLoading(true);
    
    const duration = bookingType === 'SOFT' 
      ? Number(softDuration) 
      : (bookingType === 'HARD' ? Number(hardDuration) : 0);

    const res = await createBooking({
      leadId: selectedLeadId,
      unitId: selectedUnit.id,
      organizationId,
      type: bookingType,
      duration: duration
    });
    
    if (res.success) {
      setSelectedUnit(null);
      alert('✅ Объект успешно забронирован!');
      router.refresh();
    } else {
      alert('❌ Ошибка: ' + (res.message || 'Не удалось выполнить бронирование.'));
    }
    setLoading(false);
  };

  // Helper: Получение стилей по статусу
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'FREE': return styles.free;
      case 'SOFT_BOOKED': return styles.softBooked;
      case 'RESERVATION_ORAL': return styles.softBooked;
      case 'HARD_BOOKED': return styles.hardBooked;
      case 'RESERVATION_PAID': return styles.hardBooked;
      case 'CONTRACT_SIGNED': return styles.contractSigned;
      case 'DOWN_PAYMENT_RECEIVED': return styles.downPayment;
      case 'FULLY_PAID': return styles.fullyPaid;
      case 'SOLD': return styles.fullyPaid;
      case 'SERVICE': return styles.service;
      case 'EXCLUDED': return styles.excluded;
      default: return styles.free;
    }
  };

  const getStatusName = (status: string) => {
    switch (status) {
      case 'FREE': return 'Свободна';
      case 'SOFT_BOOKED': return 'Устная бронь';
      case 'RESERVATION_ORAL': return 'Устная бронь';
      case 'HARD_BOOKED': return 'Платная бронь';
      case 'RESERVATION_PAID': return 'Платная бронь';
      case 'CONTRACT_SIGNED': return 'Договор подписан';
      case 'DOWN_PAYMENT_RECEIVED': return 'Взнос оплачен';
      case 'FULLY_PAID': return 'Полная оплата';
      case 'SOLD': return 'Продано';
      case 'SERVICE': return 'Служебная';
      case 'EXCLUDED': return 'Исключена';
      default: return 'Свободна';
    }
  };

  const currentProject = projects.find(p => p.id === activeProjectId);
  const currentBlock = currentProject?.blocks?.find((b: any) => b.id === activeBlockId);

  // Сборка этажей и квартир
  const unitsByFloor: Record<number, any[]> = {};
  currentBlock?.units?.forEach((unit: any) => {
    if (!unitsByFloor[unit.floor]) unitsByFloor[unit.floor] = [];
    unitsByFloor[unit.floor].push(unit);
  });
  const floors = Object.keys(unitsByFloor).map(Number).sort((a, b) => b - a);

  // Проверка фильтров
  const isFilteredOut = (unit: any) => {
    if (statusFilter !== 'ALL' && unit.status !== statusFilter) return true;
    if (roomsFilter !== 'ALL' && unit.rooms?.toString() !== roomsFilter) return true;
    if (priceFilter.min && unit.price < Number(priceFilter.min)) return true;
    if (priceFilter.max && unit.price > Number(priceFilter.max)) return true;
    if (areaFilter.min && unit.area < Number(areaFilter.min)) return true;
    if (areaFilter.max && unit.area > Number(areaFilter.max)) return true;
    return false;
  };

  // Статистика
  const stats = useMemo(() => {
    let free = 0, soft = 0, hard = 0, sold = 0;
    currentBlock?.units?.forEach((u: any) => {
      if (u.status === 'FREE') free++;
      if (['SOFT_BOOKED', 'RESERVATION_ORAL'].includes(u.status)) soft++;
      if (['HARD_BOOKED', 'RESERVATION_PAID'].includes(u.status)) hard++;
      if (['FULLY_PAID', 'SOLD', 'CONTRACT_SIGNED', 'DOWN_PAYMENT_RECEIVED'].includes(u.status)) sold++;
    });
    return { free, soft, hard, sold, total: currentBlock?.units?.length || 0 };
  }, [currentBlock]);

  if (!projects || projects.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <h3>Нет проектов для отображения</h3>
          <p>В базе данных пока нет ни одного жилого комплекса.</p>
          <button className={styles.createDemoBtn} onClick={async () => {
            const res = await createDemoProject(organizationId);
            if(res.success) router.refresh();
          }}>Создать демо-проект "Астана Тауэр"</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Основной контент - сдвигается когда открыт side-panel */}
      <div className={`${styles.mainContent} ${selectedUnit ? styles.mainContentShifted : ''}`}>
        <header className={styles.header}>
          <div className={styles.titleArea}>
            <h1>🏢 Умная Шахматка</h1>
            <p>Мониторинг квартирографии в реальном времени · Курс: {rateLoading ? '⏳ загрузка...' : `${exchangeRate} ₾/$`}</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button className={styles.importBtn} onClick={() => setShowImportModal(true)}>📥 Импорт Excel</button>
            <button className={styles.massPriceBtn} onClick={() => setShowMassPanel(!showMassPanel)}>💰 Массовое изменение цен</button>
            <button className={styles.createUnitBtn} onClick={() => setShowCreateUnitModal(true)}>➕ Новая квартира</button>
            <select value={activeProjectId || ''} onChange={(e) => {
              setActiveProjectId(e.target.value);
              const p = projects.find(x => x.id === e.target.value);
              setActiveBlockId(p?.blocks?.[0]?.id || null);
            }} className={styles.projectSelect}>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </header>

        {/* Массовое изменение цен - панель */}
        {showMassPanel && (
          <div className={styles.massPriceBar}>
            <div className={styles.massPriceHeader}>
              <h3>💰 Массовое изменение цен (CAT-007)</h3>
              <button className={styles.closeBtnSmall} onClick={() => setShowMassPanel(false)}>✕</button>
            </div>
            <div className={styles.massFormRow}>
              <div className={styles.formField}>
                <label>Корпус</label>
                <select value={massBlockId} onChange={e => setMassBlockId(e.target.value)}>
                  <option value="">Все корпуса</option>
                  {currentProject?.blocks?.map((b: any) => (<option key={b.id} value={b.id}>{b.number}</option>))}
                </select>
              </div>
              <div className={styles.formField}>
                <label>Комнатность</label>
                <select value={massRooms} onChange={e => setMassRooms(e.target.value)}>
                  <option value="ALL">Все</option><option value="1">1-комнатные</option><option value="2">2-комнатные</option><option value="3">3-комнатные</option>
                </select>
              </div>
              <div className={styles.formField}>
                <label>Тип изменения</label>
                <select value={massChangeType} onChange={e => setMassChangeType(e.target.value as any)}>
                  <option value="PERCENT">В процентах (%)</option><option value="FIXED">Фиксированная сумма ($)</option>
                </select>
              </div>
              <div className={styles.formField}>
                <label>Величина</label>
                <input type="number" value={massChangeValue} onChange={e => setMassChangeValue(Number(e.target.value))} />
              </div>
              <div className={styles.formField} style={{ flex: 2 }}>
                <label>Причина изменения *</label>
                <input type="text" value={massReason} onChange={e => setMassReason(e.target.value)} placeholder="Например: Корректировка цен" />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className={styles.cancelMassBtn} onClick={() => setShowMassPanel(false)}>Отмена</button>
                <button className={styles.applyMassBtn} onClick={handleMassUpdate} disabled={loading || !massReason}>{loading ? '...' : 'Применить'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Статистика */}
        <div className={styles.statsRow}>
          <div className={styles.statMini}><div className={styles.statNum}>{stats.total}</div><div className={styles.statLabel}>Всего</div></div>
          <div className={styles.statMini}><div className={styles.statNum} style={{color:'#16a34a'}}>{stats.free}</div><div className={styles.statLabel}>Свободно</div></div>
          <div className={styles.statMini}><div className={styles.statNum} style={{color:'#eab308'}}>{stats.soft}</div><div className={styles.statLabel}>Soft бронь</div></div>
          <div className={styles.statMini}><div className={styles.statNum} style={{color:'#ea580c'}}>{stats.hard}</div><div className={styles.statLabel}>Hard бронь</div></div>
          <div className={styles.statMini}><div className={styles.statNum} style={{color:'#b91c1c'}}>{stats.sold}</div><div className={styles.statLabel}>Продано</div></div>
        </div>

        {/* Фильтры */}
        <div className={styles.filterBar}>
          <div className={styles.blockTabs}>
            {currentProject?.blocks?.map((block: any) => (
              <button key={block.id} className={activeBlockId === block.id ? styles.activeTab : ''} onClick={() => setActiveBlockId(block.id)}>{block.number}</button>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className={styles.filterLabel}>Фильтры:</span>
            <select className={styles.filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="ALL">Все статусы</option><option value="FREE">Свободные</option><option value="SOFT_BOOKED">Устная бронь</option><option value="HARD_BOOKED">Платная бронь</option>
            </select>
            <select className={styles.filterSelect} value={roomsFilter} onChange={e => setRoomsFilter(e.target.value)}>
              <option value="ALL">Все комнаты</option><option value="1">1-комн.</option><option value="2">2-комн.</option><option value="3">3-комн.</option>
            </select>
            <input type="number" placeholder="Цена от" className={styles.filterInput} style={{ width: '100px' }} value={priceFilter.min} onChange={e => setPriceFilter({...priceFilter, min: e.target.value})} />
            <input type="number" placeholder="Цена до" className={styles.filterInput} style={{ width: '100px' }} value={priceFilter.max} onChange={e => setPriceFilter({...priceFilter, max: e.target.value})} />
          </div>
        </div>

        {/* Легенда */}
        <div className={styles.legend}>
          <div className={styles.legendItem}><span className={styles.freeBox}></span> Свободна</div>
          <div className={styles.legendItem}><span className={styles.softBookedBox}></span> Устная бронь</div>
          <div className={styles.legendItem}><span className={styles.hardBookedBox}></span> Платная бронь</div>
          <div className={styles.legendItem}><span className={styles.contractSignedBox}></span> Договор</div>
          <div className={styles.legendItem}><span className={styles.downPaymentBox}></span> Взнос</div>
          <div className={styles.legendItem}><span className={styles.fullyPaidBox}></span> Продано/NAPR</div>
          <div className={styles.legendItem}><span className={styles.serviceBox}></span> Служебная</div>
          <div className={styles.legendItem}><span className={styles.excludedBox}></span> Исключена</div>
        </div>

        {/* Шахматка - сетка квартир */}
        <div className={styles.gridCard}>
          <div className={styles.grid}>
            {floors.map(floor => (
              <div key={floor} className={styles.floorRow}>
                <div className={styles.floorNum}>{floor} эт.</div>
                <div className={styles.units}>
                  {unitsByFloor[floor].map(unit => {
                    const filteredOut = isFilteredOut(unit);
                    return (
                      <div key={unit.id} className={`${styles.unit} ${getStatusClass(unit.status)} ${filteredOut ? styles.dimmed : ''}`} onClick={() => handleUnitClick(unit)}>
                        <div className={styles.uNum}>{unit.number}</div>
                        <div className={styles.uInfo}>{unit.area} м² • {unit.rooms} к.</div>
                        <div className={styles.uPrice}>
                          {unit.status === 'FREE' ? (
                            <>${Math.round(unit.price).toLocaleString()}<span className={styles.gelPrice}>{Math.round(unit.price * parseFloat(exchangeRate)).toLocaleString()} ₾</span></>
                          ) : getStatusName(unit.status)}
                        </div>
                        {unit.status === 'SOFT_BOOKED' && <div className={styles.timerBadge}>23:59</div>}
                        {unit.price > 300000 && unit.status === 'FREE' && <div className={styles.vipBadge}>VIP</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Side-panel - открывается справа */}
      <div className={`${styles.sidePanel} ${selectedUnit ? styles.sidePanelOpen : ''}`}>
        {selectedUnit && (
          <>
            <div className={styles.panelHeader}>
              <div>
                <h2>Квартира №{selectedUnit.number}</h2>
                <div className={`${styles.statusPill} ${getStatusClass(selectedUnit.status)}`}>{getStatusName(selectedUnit.status)}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={openEditModal} className={styles.editUnitBtn} title="Редактировать">✏️</button>
                <button onClick={handleDeleteUnit} className={styles.deleteUnitBtn} title="Исключить из продаж">🗑️</button>
                <button onClick={closePanel} className={styles.closeBtn}>✕</button>
              </div>
            </div>

            <div className={styles.panelContent}>
              <div className={styles.paramGrid}>
                <div className={styles.paramItem}><span className={styles.paramLabel}>Площадь</span><span className={styles.paramValue}>{selectedUnit.area} м²</span></div>
                <div className={styles.paramItem}><span className={styles.paramLabel}>Комнат</span><span className={styles.paramValue}>{selectedUnit.rooms}</span></div>
                <div className={styles.paramItem}><span className={styles.paramLabel}>Цена (USD)</span><span className={styles.paramValue}>${Number(selectedUnit.price).toLocaleString()}</span></div>
                <div className={styles.paramItem}><span className={styles.paramLabel}>Цена (GEL)</span><span className={styles.paramValue}>{Math.round(selectedUnit.price * parseFloat(exchangeRate)).toLocaleString()} ₾</span></div>
              </div>

              <div className={styles.calcCard}>
                <h3>📊 Финансовый калькулятор</h3>
                <div style={{ marginBottom: '12px' }}>
                  <span className={styles.calcLabel}>Первоначальный взнос ($)</span>
                  <input type="number" value={downPayment} onChange={(e) => setDownPayment(Number(e.target.value))} className={styles.calcInput} />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <span className={styles.calcLabel}>Срок (мес)</span>
                    <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className={styles.calcInput}>
                      {[3, 6, 12, 18, 24, 36].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <span className={styles.calcLabel}>Ежемесячно</span>
                    <div className={styles.calcResult}>${monthlyPayment.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              <button type="button" className={styles.historyBtn} onClick={loadUnitPriceHistory}>📜 История цен</button>
              
              {priceHistory.length > 0 && (
                <div className={styles.priceHistoryList}>
                  <h4>Изменения цен</h4>
                  {priceHistory.map((h: any) => (
                    <div key={h.id} className={styles.priceHistoryItem}>
                      <span className={styles.oldPrice}>${Math.round(h.oldPrice).toLocaleString()}</span><span> → </span>
                      <span className={styles.newPrice}>${Math.round(h.newPrice).toLocaleString()}</span>
                      <div className={styles.priceHistoryDate}>{new Date(h.createdAt).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.actionArea}>
              {selectedUnit.status === 'FREE' ? (
                <div className={styles.bookingSection}>
                  <div>
                    <span className={styles.bookingLabel}>Тип бронирования</span>
                    <div className={styles.bookingTypeTabs}>
                      <button 
                        type="button"
                        className={`${styles.bookingTypeTab} ${bookingType === 'SOFT' ? styles.bookingTypeTabActiveSoft : ''}`} 
                        onClick={() => setBookingType('SOFT')}
                      >
                        Устная (Soft)
                      </button>
                      <button 
                        type="button"
                        className={`${styles.bookingTypeTab} ${bookingType === 'HARD' ? styles.bookingTypeTabActiveHard : ''}`} 
                        onClick={() => setBookingType('HARD')}
                      >
                        Платная (Hard)
                      </button>
                      
                        <button 
                          type="button"
                          className={`${styles.bookingTypeTab} ${bookingType === 'SERVICE' ? styles.bookingTypeTabActiveService : ''}`} 
                          onClick={() => setBookingType('SERVICE')}
                        >
                          Служебная
                        </button>
                      
                    </div>
                  </div>

                  <div>
                    {bookingType === 'SOFT' && (
                      <>
                        <span className={styles.bookingLabel}>Срок бронирования</span>
                        <select 
                          value={softDuration} 
                          onChange={(e) => setSoftDuration(e.target.value)} 
                          className={styles.leadSelect}
                        >
                          <option value="0.5">30 минут</option>
                          <option value="1">1 час</option>
                          <option value="2">2 часа</option>
                          <option value="4">4 часа</option>
                          {(userRole === 'supervisor' || userRole === 'admin' || userRole === 'rop') && (
                            <option value="24">24 часа</option>
                          )}
                        </select>
                      </>
                    )}

                    {bookingType === 'HARD' && (
                      <>
                        <span className={styles.bookingLabel}>Срок бронирования</span>
                        <select 
                          value={hardDuration} 
                          onChange={(e) => setHardDuration(e.target.value)} 
                          className={styles.leadSelect}
                        >
                          <option value="7">7 дней</option>
                          <option value="10">10 дней</option>
                          <option value="14">14 дней</option>
                          <option value="30">30 дней (под ипотеку)</option>
                        </select>
                      </>
                    )}

                    {bookingType === 'SERVICE' && (
                      <div className={styles.durationBanner}>
                        🔒 Бессрочно (до ручной отмены)
                      </div>
                    )}
                  </div>

                  <div>
                    <span className={styles.bookingLabel}>Выберите клиента</span>
                    <select 
                      value={selectedLeadId} 
                      onChange={(e) => setSelectedLeadId(e.target.value)} 
                      className={styles.leadSelect}
                    >
                      <option value="">Выберите клиента...</option>
                      {leads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>

                  <button 
                    onClick={onBook} 
                    disabled={loading || !selectedLeadId} 
                    className={styles.bookBtn}
                  >
                    {loading ? 'Загрузка...' : '⚡ Забронировать'}
                  </button>
                </div>
              ) : (
                <div className={styles.bookedAlert}><span>🔒 Объект забронирован</span></div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Модалка импорта Excel */}
      {showImportModal && (
        <div className={styles.modalOverlay} onClick={() => setShowImportModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}><h2><span>📥</span> Импорт каталога</h2><button className={styles.modalCloseBtn} onClick={() => setShowImportModal(false)}>✕</button></div>
            <div className={styles.modalBody}>
              <div className={styles.modalDesc}>📌 Загрузите файл Excel (.xlsx, .xls) с колонками:<br/><code>projectName, blockNumber, floor, number, area, rooms, price</code></div>
              <div className={`${styles.fileDropZone} ${importFile ? styles.dragActive : ''}`} onClick={() => document.getElementById('excelFileInput')?.click()}>
                <div className={styles.fileIcon}>📊</div>
                <p><strong>Нажмите для выбора</strong> или перетащите файл</p>
                <p className={styles.fileHint}>Поддерживаются .xlsx, .xls (до 10 МБ)</p>
                <input id="excelFileInput" type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setImportFile(e.target.files?.[0] || null)} className={styles.fileInput} />
              </div>
              {importFile && (
                <div className={styles.selectedFile}>
                  <span>📎</span><span className={styles.fileName}>{importFile.name}</span>
                  <span className={styles.fileSize}>{(importFile.size / 1024).toFixed(1)} KB</span>
                  <button className={styles.removeFileBtn} onClick={() => setImportFile(null)}>✕</button>
                </div>
              )}
              <div className={styles.formatExample}>
                <h4>📋 Пример формата Excel</h4>
                <table className={styles.exampleTable}><thead><tr><th>projectName</th><th>blockNumber</th><th>number</th><th>price</th></tr></thead>
                <tbody><tr><td>Астана Тауэр</td><td>А</td><td>101</td><td>18000000</td></tr>
                <tr><td>Астана Тауэр</td><td>А</td><td>102</td><td>25000000</td></tr></tbody></table>
                <button className={styles.downloadTemplateBtn} onClick={downloadTemplate}>📎 Скачать шаблон Excel</button>
              </div>
              <div className={styles.modalActions}>
                <button className={styles.modalCancelBtn} onClick={() => setShowImportModal(false)}>Отмена</button>
                <button className={styles.modalImportBtn} onClick={handleImport} disabled={loading || !importFile}>{loading ? '⏳ Импорт...' : '🚀 Загрузить'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модалка создания квартиры */}
      {showCreateUnitModal && (
        <div className={styles.modalOverlay} onClick={() => setShowCreateUnitModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h2>➕ Создание новой квартиры</h2>
            <div className={styles.formGroup}>
              <label>Корпус *</label>
              <select className={styles.input} value={selectedBlockId} onChange={e => setSelectedBlockId(e.target.value)}>
                <option value="">Выберите корпус...</option>
                {blocksList.map(b => (<option key={b.id} value={b.id}>{b.projectName} — Корпус {b.number}</option>))}
              </select>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}><label>Номер квартиры *</label><input className={styles.input} value={editUnitData.number} onChange={e => setEditUnitData({...editUnitData, number: e.target.value})} /></div>
              <div className={styles.formGroup}><label>Этаж *</label><input type="number" className={styles.input} value={editUnitData.floor} onChange={e => setEditUnitData({...editUnitData, floor: e.target.value})} /></div>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}><label>Площадь (м²) *</label><input type="number" step="0.1" className={styles.input} value={editUnitData.area} onChange={e => setEditUnitData({...editUnitData, area: e.target.value})} /></div>
              <div className={styles.formGroup}><label>Жилая площадь (м²)</label><input type="number" step="0.1" className={styles.input} value={editUnitData.livingArea} onChange={e => setEditUnitData({...editUnitData, livingArea: e.target.value})} /></div>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}><label>Комнат *</label><input type="number" className={styles.input} value={editUnitData.rooms} onChange={e => setEditUnitData({...editUnitData, rooms: e.target.value})} /></div>
              <div className={styles.formGroup}><label>Цена (USD) *</label><input type="number" className={styles.input} value={editUnitData.price} onChange={e => setEditUnitData({...editUnitData, price: e.target.value})} /></div>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}><label>Тип</label><select className={styles.input} value={editUnitData.type} onChange={e => setEditUnitData({...editUnitData, type: e.target.value})}><option value="Apartment">Квартира</option><option value="Commercial">Коммерция</option><option value="Parking">Паркинг</option><option value="Storage">Кладовка</option></select></div>
              <div className={styles.formGroup}><label>Вид из окна</label><input className={styles.input} value={editUnitData.viewType} onChange={e => setEditUnitData({...editUnitData, viewType: e.target.value})} placeholder="На город, во двор..." /></div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.modalCancelBtn} onClick={() => setShowCreateUnitModal(false)}>Отмена</button>
              <button className={styles.modalImportBtn} onClick={handleCreateUnit} disabled={loading}>Создать</button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка редактирования квартиры */}
      {showEditUnitModal && (
        <div className={styles.modalOverlay} onClick={() => setShowEditUnitModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h2>✏️ Редактирование квартиры №{selectedUnit?.number}</h2>
            <div className={styles.formRow}>
              <div className={styles.formGroup}><label>Номер квартиры</label><input className={styles.input} value={editUnitData.number} onChange={e => setEditUnitData({...editUnitData, number: e.target.value})} /></div>
              <div className={styles.formGroup}><label>Этаж</label><input type="number" className={styles.input} value={editUnitData.floor} onChange={e => setEditUnitData({...editUnitData, floor: e.target.value})} /></div>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}><label>Площадь (м²)</label><input type="number" step="0.1" className={styles.input} value={editUnitData.area} onChange={e => setEditUnitData({...editUnitData, area: e.target.value})} /></div>
              <div className={styles.formGroup}><label>Жилая площадь (м²)</label><input type="number" step="0.1" className={styles.input} value={editUnitData.livingArea} onChange={e => setEditUnitData({...editUnitData, livingArea: e.target.value})} /></div>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}><label>Комнат</label><input type="number" className={styles.input} value={editUnitData.rooms} onChange={e => setEditUnitData({...editUnitData, rooms: e.target.value})} /></div>
              <div className={styles.formGroup}><label>Цена (USD)</label><input type="number" className={styles.input} value={editUnitData.price} onChange={e => setEditUnitData({...editUnitData, price: e.target.value})} /></div>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}><label>Тип</label><select className={styles.input} value={editUnitData.type} onChange={e => setEditUnitData({...editUnitData, type: e.target.value})}><option value="Apartment">Квартира</option><option value="Commercial">Коммерция</option><option value="Parking">Паркинг</option><option value="Storage">Кладовка</option></select></div>
              <div className={styles.formGroup}><label>Вид из окна</label><input className={styles.input} value={editUnitData.viewType} onChange={e => setEditUnitData({...editUnitData, viewType: e.target.value})} /></div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.modalCancelBtn} onClick={() => setShowEditUnitModal(false)}>Отмена</button>
              <button className={styles.modalImportBtn} onClick={handleUpdateUnit} disabled={loading}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}