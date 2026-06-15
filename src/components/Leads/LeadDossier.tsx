import React, { useState, useEffect } from 'react';
import styles from './LeadDossier.module.css';
import { searchUnits, addInterest } from '@/app/actions/inventory';
import { createDeal, updateClient, getLeadById, savePaymentScheduleAction, anonymizeClient, logPhoneView, qualifyLead } from '@/app/actions/leads';
import { useRouter } from 'next/navigation';
import { getExchangeRate } from '@/app/actions/exchange';


interface LeadDossierProps {
  lead: any;
  projects?: any[];
  onClose: () => void;
  organizationId: string;
}

type Tab = 'info' | 'interests' | 'finance' | 'history';

const CLIENT_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  RESIDENT_GE: { label: 'Резидент Грузии', icon: '🇬🇪', color: '#059669' },
  NON_RESIDENT: { label: 'Нерезидент', icon: '🌍', color: '#2563eb' },
  LEGAL_ENTITY: { label: 'Юр. лицо', icon: '🏢', color: '#7c3aed' },
  LEAD: { label: 'Лид', icon: '👤', color: '#64748b' },
};

export default function LeadDossier({ lead: initialLead, projects = [], onClose, organizationId }: LeadDossierProps) {
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [lead, setLead] = useState(initialLead);
  const isClient = lead.status === 'CONVERTED' || (lead.type && lead.type !== 'LEAD');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [phoneRevealed, setPhoneRevealed] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
  const [noteText, setNoteText] = useState(initialLead.managerNotes || '');
  const [isNoteDirty, setIsNoteDirty] = useState(false);
  const [editData, setEditData] = useState({
    name: initialLead.name,
    phone: initialLead.phone,
    iin: initialLead.iin || ''
  });

  const [qualifyForm, setQualifyForm] = useState({
    interestedProjectId: initialLead.interestedProjectId || '',
    propertyType: initialLead.propertyType || 'Apartment',
    budgetMin: initialLead.budgetMin || '',
    budgetMax: initialLead.budgetMax || '',
    paymentMethod: initialLead.paymentMethod || 'Cash',
    sourceInfo: initialLead.sourceInfo || '',
    roomsInterested: initialLead.roomsInterested || '',
    areaMin: initialLead.areaMin || '',
    areaMax: initialLead.areaMax || '',
    deliveryDeadline: initialLead.deliveryDeadline || ''
  });
  const [isEditingQualify, setIsEditingQualify] = useState(false);

  // States for anonymization
  const [showAnonymizeConfirm, setShowAnonymizeConfirm] = useState(false);
  const [anonymizeReason, setAnonymizeReason] = useState('');

  // PDPS-compliance states (CLI-020/021)
  const [showRevealModal, setShowRevealModal] = useState<'phone' | 'email' | null>(null);
  const [revealReason, setRevealReason] = useState('');
  const [emailRevealed, setEmailRevealed] = useState(false);

  // Маскирование email (CLI-023)
  const maskEmail = (email: string) => {
    if (!email) return '—';
    const parts = email.split('@');
    if (parts.length !== 2) return email;
    const name = parts[0];
    const domain = parts[1];
    if (name.length <= 2) return name + '***@' + domain;
    return name[0] + '•'.repeat(name.length - 2) + name[name.length - 1] + '@' + domain;
  };

  const handleOpenReveal = (type: 'phone' | 'email') => {
    setRevealReason('');
    setShowRevealModal(type);
  };

  const handleConfirmReveal = async () => {
    if (!revealReason.trim()) {
      alert('Укажите причину раскрытия персональных данных!');
      return;
    }
    
    setLoading(true);
    if (showRevealModal === 'phone') {
      const res = await logPhoneView(lead.id, organizationId, `Просмотр телефона. Причина: ${revealReason}`);
      if (res.success) {
        setPhoneRevealed(true);
      }
    } else if (showRevealModal === 'email') {
      const res = await logPhoneView(lead.id, organizationId, `Просмотр email. Причина: ${revealReason}`);
      if (res.success) {
        setEmailRevealed(true);
      }
    }
    
    // Перезагрузим данные
    const updated = await getLeadById(lead.id);
    if (updated) setLead(updated);
    
    setShowRevealModal(null);
    setRevealReason('');
    setLoading(false);
  };



  useEffect(() => {
  async function loadRate() {
    const rate = await getExchangeRate();
    setExchangeRate(rate.toString());
  }
  loadRate();
}, []);

  useEffect(() => {
    async function loadFullData() {
      const full = await getLeadById(lead.id);
      if (full) {
        setLead(full);
        if (full.managerNotes) setNoteText(full.managerNotes);
        setQualifyForm({
          interestedProjectId: full.interestedProjectId || '',
          propertyType: full.propertyType || 'Apartment',
          budgetMin: full.budgetMin || '',
          budgetMax: full.budgetMax || '',
          paymentMethod: full.paymentMethod || 'Cash',
          sourceInfo: full.sourceInfo || '',
          roomsInterested: full.roomsInterested || '',
          areaMin: full.areaMin || '',
          areaMax: full.areaMax || '',
          deliveryDeadline: full.deliveryDeadline || ''
        });
        setFilters({
          rooms: full.roomsInterested ? full.roomsInterested.toString() : '',
          minArea: full.areaMin ? full.areaMin.toString() : '',
          maxPrice: full.budgetMax ? full.budgetMax.toString() : '',
          type: full.propertyType || 'Apartment'
        });
      }
    }
    loadFullData();
  }, [lead.id]);

  const handleSaveQualify = async () => {
    setLoading(true);
    const res = await qualifyLead(lead.id, {
      ...qualifyForm,
      budgetMin: qualifyForm.budgetMin ? parseFloat(qualifyForm.budgetMin.toString()) : undefined,
      budgetMax: qualifyForm.budgetMax ? parseFloat(qualifyForm.budgetMax.toString()) : undefined,
      roomsInterested: qualifyForm.roomsInterested ? parseInt(qualifyForm.roomsInterested.toString()) : null,
      areaMin: qualifyForm.areaMin ? parseFloat(qualifyForm.areaMin.toString()) : null,
      areaMax: qualifyForm.areaMax ? parseFloat(qualifyForm.areaMax.toString()) : null
    });
    setLoading(false);
    if (res.success) {
      setIsEditingQualify(false);
      const updated = await getLeadById(lead.id);
      if (updated) {
        setLead(updated);
        alert('Анкета квалификации лида успешно сохранена!');
      }
      router.refresh();
    } else {
      alert('Произошла ошибка при сохранении квалификации лида');
    }
  };

  const [selectedInterestForCalc, setSelectedInterestForCalc] = useState<any>(null);
  const [paymentScheme, setPaymentScheme] = useState('CASH');
  const [exchangeRate, setExchangeRate] = useState('2.70');
  const [downPayment, setDownPayment] = useState('0');
  const [installmentMonths, setInstallmentMonths] = useState('12');
  const [schedule, setSchedule] = useState<any[]>([]);

  const [filters, setFilters] = useState({ rooms: '', minArea: '', maxPrice: '', type: 'Apartment' });

  const router = useRouter();

  // Маскирование телефона: показываем только последние 4 цифры
  const maskPhone = (phone: string) => {
    if (!phone) return '—';
    if (phone.length <= 4) return phone;
    return '•'.repeat(phone.length - 4) + phone.slice(-4);
  };

  // Функция для показа телефона с логированием (CLI-021)
  const handleRevealPhone = () => {
    if (phoneRevealed) {
      setPhoneRevealed(false);
    } else {
      handleOpenReveal('phone');
    }
  };

  // Функция анонимизации
  const handleAnonymize = async () => {
    if (!anonymizeReason.trim()) {
      alert('Укажите причину анонимизации');
      return;
    }
    
    const confirmed = confirm('ВНИМАНИЕ! Это действие заменит все персональные данные клиента на "XXX". Данные о сделках и платежах сохранятся. Продолжить?');
    if (!confirmed) return;
    
    setLoading(true);
    const res = await anonymizeClient(lead.id, organizationId, anonymizeReason);
    if (res.success) {
      alert('Клиент анонимизирован');
      const updated = await getLeadById(lead.id);
      if (updated) setLead(updated);
      setShowAnonymizeConfirm(false);
      setAnonymizeReason('');
    } else {
      alert('Ошибка анонимизации: ' + (res.error || 'Неизвестная ошибка'));
    }
    setLoading(false);
  };

  const handleUpdateClient = async (customData?: any) => {
    setLoading(true);
    const dataToSave = customData || { ...editData, managerNotes: noteText };
    const res = await updateClient({ id: lead.id, ...dataToSave, managerId: organizationId });
    if (res.success) {
      setIsEditing(false);
      setIsNoteDirty(false);
      setLead({ ...lead, ...dataToSave });
      router.refresh();
      if (customData?.managerNotes) alert('Заметка сохранена');
    }
    setLoading(false);
  };

  const handleAddInterest = async (unitId: string) => {
    setLoading(true);
    const res = await addInterest(lead.id, unitId);
    if (res.success) {
      const updated = await getLeadById(lead.id);
      if (updated) setLead(updated);
      alert('Объект успешно добавлен');
    }
    setLoading(false);
  };

  const handleCreateDeal = async (interestId: string, unitId: string) => {
    // 1. Мгновенно обновляем интерфейс (Оптимистично!)
    const updatedInterests = lead.interests?.map((i: any) => 
      i.id === interestId ? { ...i, status: 'DEAL' } : i
    );
    setLead({ ...lead, interests: updatedInterests });

    // 2. В фоне отправляем запрос в БД
    const res = await createDeal({
      leadId: lead.id,
      unitId,
      interestId,
      organizationId,
      managerId: organizationId
    });

    if (res.success) {
      router.refresh();
    } else {
      alert('Ошибка при создании сделки: ' + (res.message || 'Неизвестная ошибка'));
      // Откатываем назад при ошибке
      const originalInterests = lead.interests?.map((i: any) => 
        i.id === interestId ? { ...i, status: 'ACTIVE' } : i
      );
      setLead({ ...lead, interests: originalInterests });
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    const results = await searchUnits({
      rooms: filters.rooms ? parseInt(filters.rooms) : undefined,
      maxPrice: filters.maxPrice ? parseFloat(filters.maxPrice) : undefined,
      type: filters.type,
      organizationId
    });
    setSearchResults(results);
    setLoading(false);
  };

  const generateSchedule = () => {
    if (!selectedInterestForCalc?.unit) return;
    const total = selectedInterestForCalc.unit.price || 0;
    const dp = parseFloat(downPayment || '0');
    const rate = parseFloat(exchangeRate || '1');
    const months = parseInt(installmentMonths || '1');
    
    let newSchedule = [];
    const now = new Date();
    newSchedule.push({ date: now.toLocaleDateString(), amountUSD: dp, amountGEL: Math.round(dp * rate) });

    if (paymentScheme === 'INSTALLMENT' && months > 0) {
      const monthlyUSD = Math.round(((total - dp) / months) * 100) / 100;
      for (let i = 1; i <= months; i++) {
        const nextDate = new Date();
        nextDate.setMonth(now.getMonth() + i);
        newSchedule.push({ date: nextDate.toLocaleDateString(), amountUSD: monthlyUSD, amountGEL: Math.round(monthlyUSD * rate) });
      }
    }
    setSchedule(newSchedule);
  };

  // Автоматическая загрузка сохраненного графика из БД при выборе объекта
  useEffect(() => {
    if (selectedInterestForCalc && lead.deals) {
      const deal = lead.deals.find((d: any) => d.unitId === selectedInterestForCalc.unitId);
      if (deal && deal.payments && deal.payments.length > 0) {
        const rate = parseFloat(exchangeRate || '1');
        const savedSchedule = deal.payments.map((p: any) => ({
          date: new Date(p.dueDate).toLocaleDateString(),
          amountUSD: p.amount,
          amountGEL: Math.round(p.amount * rate)
        }));
        setSchedule(savedSchedule);
        setPaymentScheme(deal.paymentType || 'CASH');
        setDownPayment(deal.downPayment?.toString() || '0');
        if (deal.paymentType === 'INSTALLMENT') {
          setInstallmentMonths((deal.payments.length - 1).toString());
        }
      } else {
        setSchedule([]);
      }
    } else {
      setSchedule([]);
    }
  }, [selectedInterestForCalc, lead.deals, exchangeRate]);

  const handleSaveSchedule = async () => {
    if (!selectedInterestForCalc?.unit) return;
    if (schedule.length === 0) {
      alert('Сначала рассчитайте график платежей!');
      return;
    }
    setLoading(true);
    const res = await savePaymentScheduleAction({
      leadId: lead.id,
      unitId: selectedInterestForCalc.unitId,
      paymentType: paymentScheme,
      downPayment: parseFloat(downPayment || '0'),
      totalAmount: selectedInterestForCalc.unit.price || 0,
      exchangeRate: parseFloat(exchangeRate || '1'),
      schedule,
      organizationId
    });

    if (res.success) {
      alert('Финансовый расчет и график платежей успешно сохранены!');
      const updated = await getLeadById(lead.id);
      if (updated) setLead(updated);
    } else {
      alert('Ошибка при сохранении расчета: ' + (res.error || 'Неизвестная ошибка'));
    }
    setLoading(false);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.leadMainInfo}>
            <div className={styles.avatarLarge}>{lead.name?.[0]}</div>
            <div className={styles.titleInfo}>
              <h2>{lead.name}</h2>
              <div className={styles.metaInfo}>
                {/* Бейдж типа клиента */}
                {(() => {
                  const ct = lead.status === 'CONVERTED' && (lead.type === 'LEAD' || !lead.type)
                    ? { label: 'Клиент', icon: '👤', color: '#059669' }
                    : (CLIENT_TYPE_LABELS[lead.type || lead.clientType || 'LEAD'] || CLIENT_TYPE_LABELS.LEAD);
                  return (
                    <span className={styles.clientTypeBadge} style={{ background: ct.color + '18', color: ct.color, border: `1px solid ${ct.color}40` }}>
                      {ct.icon} {ct.label}
                    </span>
                  );
                })()}
                <span className={styles.iinBadge}><span className={styles.dot}></span> ИИН: {lead.iin || '—'}</span>
                <span>Создан: {new Date(lead.createdAt).toLocaleDateString()} • Менеджер</span>
              </div>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>Закрыть</button>
        </header>

        <nav className={styles.tabs}>
          <button className={activeTab === 'info' ? styles.activeTab : ''} onClick={() => setActiveTab('info')}>Профиль</button>
          <button className={activeTab === 'interests' ? styles.activeTab : ''} onClick={() => setActiveTab('interests')}>Подбор объектов</button>
          {isClient && (
            <button className={activeTab === 'finance' ? styles.activeTab : ''} onClick={() => setActiveTab('finance')}>Финансовый план</button>
          )}
          <button className={activeTab === 'history' ? styles.activeTab : ''} onClick={() => setActiveTab('history')}>История активности</button>
        </nav>

        <main className={styles.content}>
          {activeTab === 'info' && (
            <div className={styles.infoTab}>
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <h3>Общая информация</h3>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button 
                      className={styles.editBtn} 
                      onClick={() => setShowAnonymizeConfirm(true)}
                      style={{ background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' }}
                    >
                      🗑️ Анонимизировать
                    </button>
                    <button className={styles.editBtn} onClick={() => setIsEditing(!isEditing)}>
                      {isEditing ? 'Отмена' : 'Редактировать профиль'}
                    </button>
                  </div>
                </div>
                <div className={styles.grid}>
                  <div className={styles.field}>
                    <label>ФИО Клиента</label>
                    {isEditing ? <input className={styles.editInput} value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} /> : <p className={styles.val}>{lead.name}</p>}
                  </div>
                  <div className={styles.field}>
                    <label>Контактный номер {isClient && '🔒'}</label>
                    {isEditing ? (
                      <input className={styles.editInput} value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <p className={styles.val}>{( !isClient || phoneRevealed) ? lead.phone : maskPhone(lead.phone)}</p>
                        {isClient && (
                          <button 
                            type="button"
                            onClick={handleRevealPhone}
                            style={{ 
                              background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', 
                              padding: '2px 8px', cursor: 'pointer', fontSize: '0.75rem', color: '#64748b',
                              fontWeight: 600
                            }}
                          >
                            {phoneRevealed ? '🔒 Скрыть' : '👁 Показать (с причиной)'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {isClient && (
                    <div className={styles.field}>
                      <label>ИИН</label>
                      {isEditing ? <input className={styles.editInput} value={editData.iin} onChange={e => setEditData({...editData, iin: e.target.value})} /> : <p className={styles.val}>{lead.iin || '—'}</p>}
                    </div>
                  )}
                  <div className={styles.field}>
                    <label>Источник лида</label>
                    <p className={styles.val}>{lead.source || '—'}</p>
                  </div>
                  {isClient && (
                    <div className={styles.field}>
                      <label>Email 🔒</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <p className={styles.val}>{emailRevealed ? lead.email : maskEmail(lead.email)}</p>
                        {lead.email && (
                          <button 
                            type="button"
                            onClick={() => emailRevealed ? setEmailRevealed(false) : handleOpenReveal('email')}
                            style={{ 
                              background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', 
                              padding: '2px 8px', cursor: 'pointer', fontSize: '0.75rem', color: '#64748b',
                              fontWeight: 600
                            }}
                          >
                            {emailRevealed ? '🔒 Скрыть' : '👁 Показать (с причиной)'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Personal Number (для резидентов Грузии) */}
                  {(lead.type === 'RESIDENT_GE' || lead.personalNumber) && (
                    <div className={styles.field}>
                      <label>🇬🇪 Personal Number</label>
                      <p className={styles.val} style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                        {lead.personalNumber || '—'}
                      </p>
                    </div>
                  )}

                  {/* Паспортные данные (для нерезидентов) */}
                  {(lead.type === 'NON_RESIDENT' || lead.passportNumber) && (
                    <>
                      <div className={styles.field}>
                        <label>🌍 Номер паспорта</label>
                        <p className={styles.val}>{lead.passportNumber || '—'}</p>
                      </div>
                      <div className={styles.field}>
                        <label>Страна гражданства</label>
                        <p className={styles.val}>{lead.passportCountry || '—'}</p>
                      </div>
                    </>
                  )}

                  {/* Для юридических лиц показываем ИНН */}
                  {lead.type === 'LEGAL_ENTITY' && lead.iin && (
                    <div className={styles.field}>
                      <label>🏢 ИНН / Identification Code</label>
                      <p className={styles.val}>{lead.iin}</p>
                    </div>
                  )}

                  {/* Кодовое слово */}
                  {lead.codeWord && (
                    <div className={styles.field}>
                      <label>🔐 Кодовое слово</label>
                      <p className={styles.val}>{lead.codeWord}</p>
                    </div>
                  )}
                </div>
                {isEditing && <button className={styles.saveChangesBtn} onClick={() => handleUpdateClient()} disabled={loading}>{loading ? 'Сохранение...' : 'Сохранить изменения'}</button>}
              </div>

              {/* Анкета квалификации для Лида */}
              {!isClient && (
                <div className={styles.sectionCard}>
                  <div className={styles.sectionHeader}>
                    <h3>📋 Анкета квалификации лида</h3>
                    {lead.interestedProjectId && (
                      <button className={styles.editBtn} onClick={() => setIsEditingQualify(!isEditingQualify)}>
                        {isEditingQualify ? 'Отмена' : 'Редактировать анкету'}
                      </button>
                    )}
                  </div>

                  {isEditingQualify ? (
                    <div>
                      <div className={styles.grid} style={{ marginBottom: '24px' }}>
                        <div className={styles.field}>
                          <label>ЖК интереса</label>
                          <select className={styles.editInput} value={qualifyForm.interestedProjectId} onChange={e => setQualifyForm({...qualifyForm, interestedProjectId: e.target.value})}>
                            <option value="">Не выбран</option>
                            {projects && projects.map((p: any) => (
                              <option key={p.id} value={p.id}>{p.nameRu || p.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className={styles.field}>
                          <label>Тип недвижимости</label>
                          <select className={styles.editInput} value={qualifyForm.propertyType} onChange={e => setQualifyForm({...qualifyForm, propertyType: e.target.value})}>
                            <option value="Apartment">Квартира</option>
                            <option value="Commercial">Коммерция</option>
                            <option value="Parking">Паркинг</option>
                            <option value="Storage">Кладовка</option>
                          </select>
                        </div>
                        <div className={styles.field}>
                          <label>Комнатность</label>
                          <select className={styles.editInput} value={qualifyForm.roomsInterested} onChange={e => setQualifyForm({...qualifyForm, roomsInterested: e.target.value})}>
                            <option value="">Любая</option>
                            <option value="1">1 комната</option>
                            <option value="2">2 комнаты</option>
                            <option value="3">3 комнаты</option>
                            <option value="4">4+ комнаты</option>
                          </select>
                        </div>
                        <div className={styles.field}>
                          <label>Срок сдачи</label>
                          <select className={styles.editInput} value={qualifyForm.deliveryDeadline} onChange={e => setQualifyForm({...qualifyForm, deliveryDeadline: e.target.value})}>
                            <option value="">Не важно</option>
                            <option value="2024">2024 год</option>
                            <option value="2025">2025 год</option>
                            <option value="2026">2026 год</option>
                            <option value="2027+">2027+ год</option>
                          </select>
                        </div>
                        <div className={styles.field}>
                          <label>Способ оплаты</label>
                          <select className={styles.editInput} value={qualifyForm.paymentMethod} onChange={e => setQualifyForm({...qualifyForm, paymentMethod: e.target.value})}>
                            <option value="Cash">100% оплата</option>
                            <option value="Installment">Рассрочка</option>
                            <option value="Mortgage">Ипотека</option>
                            <option value="Cession">Цессия</option>
                          </select>
                        </div>
                        <div className={styles.field}>
                          <label>Доп. инфо (источник)</label>
                          <input className={styles.editInput} placeholder="Детали источника" value={qualifyForm.sourceInfo} onChange={e => setQualifyForm({...qualifyForm, sourceInfo: e.target.value})} />
                        </div>
                        <div className={styles.field}>
                          <label>Площадь (м²)</label>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <input className={styles.editInput} placeholder="От" value={qualifyForm.areaMin} onChange={e => setQualifyForm({...qualifyForm, areaMin: e.target.value})} />
                            <input className={styles.editInput} placeholder="До" value={qualifyForm.areaMax} onChange={e => setQualifyForm({...qualifyForm, areaMax: e.target.value})} />
                          </div>
                        </div>
                        <div className={styles.field}>
                          <label>Бюджет (USD)</label>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <input className={styles.editInput} placeholder="От" value={qualifyForm.budgetMin} onChange={e => setQualifyForm({...qualifyForm, budgetMin: e.target.value})} />
                            <input className={styles.editInput} placeholder="До" value={qualifyForm.budgetMax} onChange={e => setQualifyForm({...qualifyForm, budgetMax: e.target.value})} />
                          </div>
                        </div>
                      </div>
                      <button className={styles.saveChangesBtn} style={{ marginTop: 0 }} onClick={handleSaveQualify} disabled={loading}>
                        {loading ? 'Сохранение...' : 'Сохранить анкету'}
                      </button>
                    </div>
                  ) : lead.interestedProjectId ? (
                    <div className={styles.grid}>
                      <div className={styles.field}>
                        <label>ЖК интереса</label>
                        <p className={styles.val}>{lead.interestedProjectName || lead.interestedProjectId}</p>
                      </div>
                      <div className={styles.field}>
                        <label>Тип недвижимости</label>
                        <p className={styles.val}>{lead.propertyType === 'Apartment' ? 'Квартира' : lead.propertyType === 'Commercial' ? 'Коммерция' : lead.propertyType || '—'}</p>
                      </div>
                      <div className={styles.field}>
                        <label>Комнатность</label>
                        <p className={styles.val}>{lead.roomsInterested ? `${lead.roomsInterested} комн.` : 'Любая'}</p>
                      </div>
                      <div className={styles.field}>
                        <label>Площадь</label>
                        <p className={styles.val}>
                          {lead.areaMin || lead.areaMax ? `${lead.areaMin || 0} – ${lead.areaMax || '∞'} м²` : 'Не важно'}
                        </p>
                      </div>
                      <div className={styles.field}>
                        <label>Бюджет</label>
                        <p className={styles.val}>
                          {lead.budgetMin || lead.budgetMax ? `$${(lead.budgetMin || 0).toLocaleString()} – $${(lead.budgetMax || '∞').toLocaleString()}` : 'Не важно'}
                        </p>
                      </div>
                      <div className={styles.field}>
                        <label>Способ оплаты</label>
                        <p className={styles.val}>
                          {lead.paymentMethod === 'Cash' ? '100% оплата' : lead.paymentMethod === 'Installment' ? 'Рассрочка' : lead.paymentMethod === 'Mortgage' ? 'Ипотека' : lead.paymentMethod || '—'}
                        </p>
                      </div>
                      <div className={styles.field}>
                        <label>Срок сдачи</label>
                        <p className={styles.val}>{lead.deliveryDeadline || 'Не важно'}</p>
                      </div>
                      <div className={styles.field}>
                        <label>Детали источника</label>
                        <p className={styles.val}>{lead.sourceInfo || '—'}</p>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '24px', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                      <p style={{ color: '#64748b', margin: '0 0 16px 0', fontSize: '0.95rem' }}>Анкета квалификации этого лида еще не заполнена.</p>
                      <button className={`${styles.editBtn}`} style={{ background: '#2563eb', color: 'white', border: 'none' }} onClick={() => setIsEditingQualify(true)}>
                        📋 Заполнить анкету квалификации
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* PDPS Согласия */}
              {isClient && (
                <div className={styles.sectionCard}>
                  <div className={styles.sectionHeader}>
                    <h3>🛡️ Согласие PDPS</h3>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ 
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', 
                      borderRadius: '12px', fontSize: '0.9rem', fontWeight: 600,
                      background: lead.consentToPdProcessing ? '#ecfdf5' : '#fef2f2',
                      color: lead.consentToPdProcessing ? '#059669' : '#dc2626',
                      border: `1px solid ${lead.consentToPdProcessing ? '#a7f3d0' : '#fecaca'}`
                    }}>
                      {lead.consentToPdProcessing ? '✅' : '❌'} Обработка ПД
                    </div>
                    <div style={{ 
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', 
                      borderRadius: '12px', fontSize: '0.9rem', fontWeight: 600,
                      background: lead.optInMarketing ? '#ecfdf5' : '#f8fafc',
                      color: lead.optInMarketing ? '#059669' : '#94a3b8',
                      border: `1px solid ${lead.optInMarketing ? '#a7f3d0' : '#e2e8f0'}`
                    }}>
                      {lead.optInMarketing ? '✅' : '—'} Маркетинг
                    </div>
                  </div>
                </div>
              )}

              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <h3>Внутренние заметки менеджера</h3>
                </div>
                <textarea 
                  className={styles.modernInput}
                  style={{ minHeight: '150px', width: '100%', resize: 'vertical' }}
                  value={noteText}
                  onChange={(e) => {
                    setNoteText(e.target.value);
                    setIsNoteDirty(true);
                  }}
                  placeholder="Детали общения, предпочтения клиента, важные комментарии..."
                />
                {isNoteDirty && (
                  <button 
                    className={styles.saveNoteBtn} 
                    onClick={() => handleUpdateClient({ managerNotes: noteText })}
                    disabled={loading}
                  >
                    {loading ? '...' : 'Сохранить заметку'}
                  </button>
                )}
              </div>

              
            </div>
          )}

          {activeTab === 'interests' && (
            <div className={styles.interestsTab}>
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}><h3>Поиск недвижимости</h3></div>
                <div className={styles.filterBarRow}>
                  <select className={styles.modernSelect} value={filters.type} onChange={(e) => setFilters({...filters, type: e.target.value})}>
                    <option value="Apartment">Квартира</option><option value="Commercial">Коммерция</option>
                  </select>
                  <input className={styles.modernInput} type="number" placeholder="Комнат" value={filters.rooms} onChange={(e) => setFilters({...filters, rooms: e.target.value})} />
                  <input className={styles.modernInput} type="number" placeholder="Бюджет" value={filters.maxPrice} onChange={(e) => setFilters({...filters, maxPrice: e.target.value})} />
                  <button className={styles.modernSearchBtn} onClick={handleSearch} disabled={loading}>{loading ? '...' : 'Найти объекты'}</button>
                </div>
                <div className={styles.unitGrid}>
                  {searchResults.map(unit => (
                    <div key={unit.id} className={styles.unitCardCompact}>
                      <div className={styles.unitInfo}>
                        <strong>{unit.block?.project?.name}, №{unit.number}</strong>
                        <span>{unit.rooms} комн. • {unit.area} м² • {unit.floor} эт.</span>
                        <span className={styles.unitPrice}>{(unit.price || 0).toLocaleString()}</span>
                      </div>
                      {unit.isSold ? (
                        <button className={styles.unitSoldBtn} disabled>Продано</button>
                      ) : unit.isBooked ? (
                        <button className={styles.unitBookedBtn} disabled>Забронировано</button>
                      ) : (
                        <button className={styles.unitSelectBtn} onClick={() => handleAddInterest(unit.id)}>Выбрать</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}><h3>Выбранные варианты</h3></div>
                <div className={styles.interestListModern}>
                  {lead.interests?.map((i: any) => (
                    <div key={i.id} className={styles.interestRow}>
                      <span className={styles.statusBadge} data-status={i.status}>{i.status === 'DEAL' ? 'В сделке' : 'Активно'}</span>
                      <div className={styles.interestTitle}><strong>{i.unit?.block?.project?.name}</strong><span>№{i.unit?.number} • {(i.unit?.price || 0).toLocaleString()}</span></div>
                      {i.status === 'ACTIVE' && <button className={styles.dealBtn} onClick={() => handleCreateDeal(i.id, i.unitId)}>Сделка</button>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

  {activeTab === 'finance' && (
  <div className={styles.financeTab}>
    <div className={styles.financeGrid}>
      {/* Левая колонка - настройки */}
      <div className={styles.calcSidebarModern}>
        <div className={styles.field}>
          <label className={styles.fieldLabelLarge}>🏠 ОБЪЕКТ ДЛЯ РАСЧЕТА</label>
          <select 
            className={styles.modernSelectLarge} 
            value={selectedInterestForCalc?.id || ''}
            onChange={(e) => {
              const interest = lead.interests?.find((i: any) => i.id === e.target.value);
              setSelectedInterestForCalc(interest);
            }}
          >
            <option value="">— Выберите объект —</option>
            {lead.interests?.map((i: any) => (
              <option key={i.id} value={i.id}>
                {i.unit?.block?.project?.name}, №{i.unit?.number} — ${(i.unit?.price || 0).toLocaleString()}
              </option>
            ))}
          </select>
        </div>

        {selectedInterestForCalc && (
          <div className={styles.calcOptions}>
            <div className={styles.field}>
              <label>💳 Схема оплаты</label>
              <select className={styles.modernSelect} value={paymentScheme} onChange={(e) => setPaymentScheme(e.target.value)}>
                <option value="CASH">💰 100% Оплата</option>
                <option value="INSTALLMENT">📅 Рассрочка</option>
              </select>
            </div>
            
            <div className={styles.field}>
              <label>🇬🇪 Курс GEL (₾ / $)</label>
              <input 
                className={styles.modernInput} 
                value={exchangeRate} 
                onChange={e => setExchangeRate(e.target.value)} 
              />
              <span className={styles.rateHint}></span>
            </div>
            
            <div className={styles.field}>
              <label>💵 Первоначальный взнос ($)</label>
              <input 
                className={styles.modernInput} 
                value={downPayment} 
                onChange={e => setDownPayment(e.target.value)} 
                placeholder="0"
              />
            </div>
            
            {paymentScheme === 'INSTALLMENT' && (
              <div className={styles.field}>
                <label>📆 Срок рассрочки (мес)</label>
                <input 
                  className={styles.modernInput} 
                  value={installmentMonths} 
                  onChange={e => setInstallmentMonths(e.target.value)} 
                />
              </div>
            )}
            
            <div className={styles.buttonGroup}>
              <button className={styles.generateBtn} onClick={generateSchedule}>
                📊 Рассчитать график
              </button>
              <button className={styles.saveScheduleBtn} onClick={handleSaveSchedule}>
                💾 Сохранить расчет
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Правая колонка - результат */}
      <div className={styles.scheduleView}>
        {schedule.length > 0 ? (
          <>
            {/* Крупные итоги */}
            <div className={styles.totalCard}>
              <div className={styles.totalItem}>
                <span className={styles.totalLabel}>💰 Общая сумма (USD)</span>
                <span className={styles.totalValueUSD}>
                  ${schedule.reduce((sum, r) => sum + r.amountUSD, 0).toLocaleString()}
                </span>
              </div>
              <div className={styles.totalDivider}></div>
              <div className={styles.totalItem}>
                <span className={styles.totalLabel}>🇬🇪 Общая сумма (GEL)</span>
                <span className={styles.totalValueGEL}>
                  {schedule.reduce((sum, r) => sum + r.amountGEL, 0).toLocaleString()} ₾
                </span>
              </div>
            </div>

            {/* Таблица платежей */}
            <div className={styles.scheduleTableWrapper}>
              <table className={styles.modernTableLarge}>
                <thead>
                  <tr>
                    <th>№</th>
                    <th>Дата</th>
                    <th>Сумма (USD)</th>
                    <th>Сумма (GEL)</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((r, idx) => (
                    <tr key={idx}>
                      <td className={styles.periodCell}>{idx + 1}</td>
                      <td className={styles.dateCell}>{r.date}</td>
                      <td className={styles.usdCell}>${r.amountUSD.toLocaleString()}</td>
                      <td className={styles.gelCell}>{r.amountGEL.toLocaleString()} ₾</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : lead.deals?.some((d: any) => d.payments?.length > 0) ? (
          <div className={styles.activePlanCardLarge}>
            <div className={styles.activePlanIconLarge}>📋</div>
            <h3>Активный финансовый план</h3>
            <p className={styles.activePlanDesc}>
              {lead.deals.find((d: any) => d.payments?.length > 0)?.projectName}, 
              №{lead.deals.find((d: any) => d.payments?.length > 0)?.unitNumber}
            </p>
            <button 
              className={styles.viewPlanDetailsBtnLarge}
              onClick={() => {
                const activeDeal = lead.deals.find((d: any) => d.payments?.length > 0);
                if (!activeDeal) return;
                const interest = lead.interests?.find((i: any) => i.unitId === activeDeal.unitId);
                if (interest) setSelectedInterestForCalc(interest);
                const rate = parseFloat(exchangeRate || '2.70');
                const savedSchedule = activeDeal.payments.map((p: any) => ({
                  date: new Date(p.dueDate).toLocaleDateString(),
                  amountUSD: p.amount,
                  amountGEL: Math.round(p.amount * rate)
                }));
                setSchedule(savedSchedule);
                setPaymentScheme(activeDeal.paymentType || 'CASH');
                setDownPayment(activeDeal.downPayment?.toString() || '0');
                if (activeDeal.paymentType === 'INSTALLMENT') {
                  setInstallmentMonths((activeDeal.payments.length - 1).toString());
                }
              }}
            >
              Показать расчет
            </button>
          </div>
        ) : (
          <div className={styles.emptyStateLarge}>
            <div className={styles.emptyIconLarge}>📊</div>
            <p>Выберите объект и настройте параметры расчета</p>
          </div>
        )}
      </div>
    </div>
  </div>
)}

          {activeTab === 'history' && (
            <div className={styles.historyTab}>
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}><h3>Журнал изменений</h3></div>
                <table className={styles.modernTable}>
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Поле</th>
                      <th>Было</th>
                      <th>Стало</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lead.logs?.map((l: any) => (
                      <tr key={l.id}>
                        <td>{new Date(l.createdAt).toLocaleString()}</td>
                        <td><strong>{l.field}</strong></td>
                        <td className={styles.oldVal}>{l.oldValue || '—'}</td>
                        <td className={styles.newVal}>{l.newValue}</td>
                      </tr>
                    ))}
                    {(!lead.logs || lead.logs.length === 0) && (
                      <tr>
                        <td colSpan={4} className={styles.emptyTable}>История изменений пуста</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Модальное окно подтверждения анонимизации */}
      {showAnonymizeConfirm && (
        <div className={styles.modalOverlay} onClick={() => setShowAnonymizeConfirm(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>🗑️ Анонимизация клиента</h3>
            <p>Вы уверены, что хотите анонимизировать клиента <strong>{lead.name}</strong>?</p>
            <p>Все персональные данные будут заменены на "XXX":</p>
            <ul>
              <li>ФИО → XXX</li>
              <li>Телефон → XXX</li>
              <li>Email → (удален)</li>
              <li>ИИН/Personal Number/Паспорт → (удалены)</li>
              <li>Кодовое слово → (удалено)</li>
            </ul>
            <p>Данные о сделках и платежах сохранятся.</p>
            <textarea
              placeholder="Причина анонимизации (обязательно)"
              value={anonymizeReason}
              onChange={(e) => setAnonymizeReason(e.target.value)}
              rows={3}
              style={{ width: '100%', padding: '8px', margin: '16px 0', borderRadius: '8px', border: '1px solid #ccc', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => {
                  setShowAnonymizeConfirm(false);
                  setAnonymizeReason('');
                }} 
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #ccc', background: 'white', cursor: 'pointer' }}
              >
                Отмена
              </button>
              <button 
                onClick={handleAnonymize} 
                style={{ padding: '8px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              >
                Подтвердить анонимизацию
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно запроса причины просмотра маскированных ПД (CLI-021) */}
      {showRevealModal && (
        <div className={styles.modalOverlay} onClick={() => setShowRevealModal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🛡️ Запрос доступа к персональным данным
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '12px 0' }}>
              В соответствии с Законом Грузии о защите персональных данных (PDPS), просмотр полного значения поля <strong>{showRevealModal === 'phone' ? 'Контактный номер' : 'Email'}</strong> должен быть обоснован.
            </p>
            <textarea
              placeholder="Укажите причину просмотра (например: Звонок клиенту по поводу договора)"
              value={revealReason}
              onChange={(e) => setRevealReason(e.target.value)}
              rows={3}
              style={{ width: '100%', padding: '10px', margin: '8px 0 16px 0', borderRadius: '8px', border: '1px solid #cbd5e1', fontFamily: 'inherit', fontSize: '0.9rem', outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => {
                  setShowRevealModal(null);
                  setRevealReason('');
                }} 
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
              >
                Отмена
              </button>
              <button 
                onClick={handleConfirmReveal} 
                disabled={loading || !revealReason.trim()}
                style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}
              >
                {loading ? 'Секунду...' : 'Подтвердить и раскрыть'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}