import { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  LayoutDashboard,
  CheckSquare,
  Calendar as CalendarIcon,
  ShoppingCart,
  Trophy,
  Settings,
  Plus,
  Check,
  Trash2,
  Wifi,
  WifiOff,
  RefreshCw,
  BarChart3,
  Tablet,
  Coins,
  LogOut,
  PlusCircle,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  User,
  Users,
  Database,
  Award,
  ArrowLeft,
  Palette,
  Globe,
  Clock,
  Sun,
  Moon,
  CloudRain,
  Sparkles,
  Pin,
  Wand2,
  ShoppingBag,
  Eye,
  EyeOff,
  Key,
  Shield,
  Upload,
  Download,
  Archive
} from 'lucide-react';


import { db, queueSyncOperation, generateUUID } from './db';
import { TRANSLATIONS } from './translations';
import type {
  Chore,
  ShoppingItem,
  Reward,
  PointLog,
  PurchaseRecord
} from './db';

const DEFAULT_BACKEND_URL =
  window.location.port && window.location.port !== '5000'
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : window.location.origin;

// --- FUNÇÕES AUXILIARES DE AGENDAMENTO E DATAS ---
const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const LOCALE_MAP: Record<string, string> = {
  pt: 'pt-BR',
  en: 'en-US',
  es: 'es-ES',
  pl: 'pl-PL',
  de: 'de-DE',
  fr: 'fr-FR',
  it: 'it-IT'
};

const getLocalizedDate = (d: Date, lang: string) => {
  const locale = LOCALE_MAP[lang] || 'en-US';
  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
  const formatted = formatter.format(d);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

const getCategoryTranslationKey = (category: string): string => {
  switch (category) {
    case 'Alimentos': return 'categoryAlimentos';
    case 'Higiene': return 'categoryHigiene';
    case 'Limpeza': return 'categoryLimpeza';
    case 'Farmácia': return 'categoryFarmacia';
    case 'Pet': return 'categoryPet';
    case 'Bebê': return 'categoryBebe';
    case 'Casa & Utensílios': return 'categoryCasaUtensilios';
    case 'Outros': return 'categoryOutros';
    case 'Sem categoria': return 'categorySemCategoria';
    default: return 'categorySemCategoria';
  }
};

const getLocalizedMonths = (lang: string): string[] => {
  const locale = LOCALE_MAP[lang] || 'en-US';
  const formatter = new Intl.DateTimeFormat(locale, { month: 'long' });
  const result: string[] = [];
  for (let m = 0; m < 12; m++) {
    const d = new Date(2023, m, 1);
    let monthStr = formatter.format(d);
    monthStr = monthStr.charAt(0).toUpperCase() + monthStr.slice(1);
    result.push(monthStr);
  }
  return result;
};

const getLocalizedWeekdays = (lang: string, formatStyle: 'short' | 'long' = 'short'): string[] => {
  const locale = LOCALE_MAP[lang] || 'en-US';
  const formatter = new Intl.DateTimeFormat(locale, { weekday: formatStyle });
  const result: string[] = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(2023, 0, i); // Jan 1, 2023 was a Sunday
    let dayStr = formatter.format(d);
    dayStr = dayStr.replace(/\.$/, ''); // Remove trailing dots from abbreviated days in French/Spanish
    dayStr = dayStr.charAt(0).toUpperCase() + dayStr.slice(1);
    result.push(dayStr);
  }
  return result;
};

const parseDateStr = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const getDaysDiff = (date1: Date, date2: Date): number => {
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
};

const addDaysToDateStr = (dateStr: string, days: number): string => {
  const date = parseDateStr(dateStr);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getChoreColorCategory = (chore: Chore): 'medication' | 'work' | 'cleaning' => {
  if (chore.is_medication) return 'medication';
  
  const title = (chore.title || '').toLowerCase();
  const desc = (chore.description || '').toLowerCase();
  
  const medKeywords = ['remedio', 'remédio', 'médico', 'medico', 'vacina', 'saúde', 'saude', 'dor', 'medicação', 'medicacao', 'consulta', 'dentista', 'hospital', 'exame', 'clinica', 'clínica', 'terapia', 'psicolog', 'fisioterap'];
  if (medKeywords.some(kw => title.includes(kw) || desc.includes(kw))) {
    return 'medication';
  }

  const workKeywords = ['estudo', 'estudar', 'prova', 'trabalho', 'trabalhar', 'lição', 'licao', 'aula', 'curso', 'ler', 'livro', 'escola', 'faculdade', 'reunião', 'reuniao', 'job', 'task', 'dev', 'programar', 'escrever', 'estudos', 'office', 'code', 'homework', 'projeto', 'homework'];
  if (workKeywords.some(kw => title.includes(kw) || desc.includes(kw))) {
    return 'work';
  }
  
  return 'cleaning';
};


const isChoreActiveOnDate = (chore: Chore, dateStr: string): boolean => {
  const todayStr = getTodayStr();
  const startDateStr = chore.start_date || (chore.completed_at ? new Date(chore.completed_at).toISOString().split('T')[0] : todayStr);
  
  if (dateStr < startDateStr) {
    return false;
  }

  if (chore.end_date && dateStr > chore.end_date) {
    return false;
  }

  if (!chore.repeats) {
    const isCompletedOnThisDate = isChoreCompletedOnDate(chore, dateStr);
    const hasAnyCompletion = !!(chore.completed_at || (chore.completed_dates && chore.completed_dates.length > 0));
    
    return (
      dateStr === startDateStr ||
      isCompletedOnThisDate ||
      (dateStr === todayStr && !hasAnyCompletion)
    );
  }

  const startDate = parseDateStr(startDateStr);
  const targetDate = parseDateStr(dateStr);
  
  const daysDiff = getDaysDiff(startDate, targetDate);
  const interval = chore.recurrence_interval || 1;

  if (chore.recurrence_type === 'daily') {
    return daysDiff % interval === 0;
  }

  if (chore.recurrence_type === 'weekly') {
    const daysAbbr = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const targetDayName = daysAbbr[targetDate.getDay()];
    const weeksDiff = Math.floor(daysDiff / 7);
    const isWeekIntervalMatch = weeksDiff % interval === 0;
    
    if (chore.recurrence_days && chore.recurrence_days.length > 0) {
      return chore.recurrence_days.includes(targetDayName);
    } else {
      return targetDate.getDay() === startDate.getDay() && isWeekIntervalMatch;
    }
  }

  if (chore.recurrence_type === 'custom_days') {
    const daysAbbr = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const targetDayName = daysAbbr[targetDate.getDay()];
    if (chore.recurrence_days && chore.recurrence_days.length > 0) {
      return chore.recurrence_days.includes(targetDayName);
    }
    return false;
  }

  if (chore.recurrence_type === 'monthly') {
    const yearDiff = targetDate.getFullYear() - startDate.getFullYear();
    const monthDiff = (targetDate.getMonth() + yearDiff * 12) - startDate.getMonth();
    const isMonthIntervalMatch = monthDiff % interval === 0;
    const isDayOfMonthMatch = targetDate.getDate() === startDate.getDate();
    return isMonthIntervalMatch && isDayOfMonthMatch;
  }

  // Retrocompatibilidade para dados legados sem o campo 'repeats'
  if (chore.repeats === undefined) {
    if (chore.frequency === 'daily') {
      return true;
    }
    if (chore.frequency === 'weekly' || chore.frequency === 'custom') {
      const daysAbbr = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const targetDayName = daysAbbr[targetDate.getDay()];
      if (chore.custom_recurrence?.days && chore.custom_recurrence.days.includes(targetDayName)) {
        return true;
      }
      return false;
    }
  }

  return false;
};

const getMedicationDoseOnDate = (chore: Chore, dateStr: string, language: string = 'en'): string => {
  const noDoseStr = TRANSLATIONS[language]?.['noDose'] || TRANSLATIONS['en']?.['noDose'] || 'Sem dose';
  if (!chore.is_medication) return '';
  const todayStr = getTodayStr();
  
  if (chore.medication_cycle && chore.medication_cycle.length > 0) {
    const startDateStr = chore.start_date || (chore.completed_at ? new Date(chore.completed_at).toISOString().split('T')[0] : todayStr);
    if (dateStr < startDateStr) return noDoseStr;
    const startDate = parseDateStr(startDateStr);
    const targetDate = parseDateStr(dateStr);
    const daysDiff = getDaysDiff(startDate, targetDate);
    const index = daysDiff % chore.medication_cycle.length;
    const val = chore.medication_cycle[index];
    if (val === 'Sem dose') return noDoseStr;
    return val || noDoseStr;
  }
  
  if (chore.medication_dosages) {
    const daysAbbr = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const targetDayName = daysAbbr[parseDateStr(dateStr).getDay()];
    const val = chore.medication_dosages[targetDayName];
    if (val === 'Sem dose') return noDoseStr;
    return val || noDoseStr;
  }
  
  return '1 dose';
};

const isChoreCompletedOnDate = (chore: Chore, dateStr: string): boolean => {
  if (chore.repeats) {
    return !!(chore.completed_dates && chore.completed_dates.includes(dateStr));
  }
  if (chore.completed_dates && chore.completed_dates.includes(dateStr)) {
    return true;
  }
  if (chore.completed_at) {
    const compDate = new Date(chore.completed_at);
    const compDateStr = `${compDate.getFullYear()}-${String(compDate.getMonth() + 1).padStart(2, '0')}-${String(compDate.getDate()).padStart(2, '0')}`;
    return compDateStr === dateStr;
  }
  return false;
};

const sortChoresChronologically = (a: Chore, b: Chore): number => {
  const getTimeTypeScore = (c: Chore) => {
    if (c.time_type === 'fixed') return 1;
    if (c.time_type === 'period') return 2;
    return 3;
  };

  const scoreA = getTimeTypeScore(a);
  const scoreB = getTimeTypeScore(b);

  if (scoreA !== scoreB) {
    return scoreA - scoreB;
  }

  if (a.time_type === 'fixed') {
    const timeA = a.fixed_time || '00:00';
    const timeB = b.fixed_time || '00:00';
    return timeA.localeCompare(timeB);
  }

  if (a.time_type === 'period') {
    const periodScores = { 'manha': 1, 'tarde': 2, 'noite': 3 };
    const pA = a.period_time ? periodScores[a.period_time] : 1;
    const pB = b.period_time ? periodScores[b.period_time] : 1;
    return pA - pB;
  }

  return a.title.localeCompare(b.title);
};


// --- SINTETIZADOR DE SOM NATIVO (Web Audio API - 0 Bytes) ---
const playChimeSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Primeiro tom (brilhante)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
    
    gain1.gain.setValueAtTime(0.12, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.3);

    // Segundo tom (sucesso / harmônico)
    setTimeout(() => {
      try {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, ctx.currentTime); // A5
        osc2.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.2); // D6
        
        gain2.gain.setValueAtTime(0.12, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        
        osc2.start(ctx.currentTime);
        osc2.stop(ctx.currentTime + 0.4);
      } catch (e) {
        console.error('Erro na segunda fase do chime de áudio:', e);
      }
    }, 80);
    
  } catch (err) {
    console.error('Erro ao sintetizar áudio via Web Audio API:', err);
  }
};

function App() {
  // --- ESTADO GLOBAL ---
  const [activeTab, setActiveTab] = useState<'dashboard' | 'calendar' | 'shopping' | 'gamification' | 'reports' | 'settings'>('dashboard');
  const [isAuthenticated, setIsAuth] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [family, setFamily] = useState<any>(null);
  
  const [editingChore, setEditingChore] = useState<Chore | null>(null);
  
  // Conexões e Sincronização
  const [backendUrl, setBackendUrl] = useState<string>(DEFAULT_BACKEND_URL);
  const [isOnline, setIsOnline] = useState<boolean>(true); // Modo simulador offline
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);
  const [authError, setAuthError] = useState<string | null>(null);

  // Telas de Autenticação
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');

  // Membros Dinâmicos e Títulos
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [newFamilyName, setNewFamilyName] = useState<string>('');
  const [addMemUsername, setAddMemUsername] = useState<string>('');
  const [addMemPassword, setAddMemPassword] = useState<string>('');
  const [addMemRole, setAddMemRole] = useState<string>('user');
  const [addMemTitle, setAddMemTitle] = useState<string>('Filho');
  const [showArchivedShopping, setShowArchivedShopping] = useState<boolean>(false);

  const [isFridgeMode, setIsFridgeMode] = useState<boolean>(false);
  const [fridgeShoppingInput, setFridgeShoppingInput] = useState<string>('');

  // Estados para Edição de Perfil de Usuário
  const [profileUsername, setProfileUsername] = useState<string>('');
  const [profileDisplayName, setProfileDisplayName] = useState<string>('');
  const [profileEmail, setProfileEmail] = useState<string>('');
  const [profileBirthDate, setProfileBirthDate] = useState<string>('');
  const [profileGender, setProfileGender] = useState<string>('Não Informar');
  const [profileFamilyTitle, setProfileFamilyTitle] = useState<string>('Membro');
  const [activeSettingsSection, setActiveSettingsSection] = useState<string>('menu');
  const [reportsSelectedUser, setReportsSelectedUser] = useState<string>('all');
  const [reportsSelectedType, setReportsSelectedType] = useState<string>('all');
  const [reportsSearch, setReportsSearch] = useState<string>('');
  const [profilePassword, setProfilePassword] = useState<string>('');
  const [profileSaveSuccess, setProfileSaveSuccess] = useState<string | null>(null);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);

  // Estados para Configuração Inicial de Segurança (Remoção do usuário 'admin' padrão)
  const [setupDisplayName, setSetupDisplayName] = useState<string>('');
  const [setupUsername, setSetupUsername] = useState<string>('');
  const [setupPassword, setSetupPassword] = useState<string>('');
  const [setupFamilyTitle, setSetupFamilyTitle] = useState<string>('Outro');
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState<boolean>(false);

  // --- ESTADO DE IDIOMA & TRADUÇÃO ---
  const [language, setLanguage] = useState<string>('en');
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(true);

  const t = (key: string): string => {
    return TRANSLATIONS[language]?.[key] || TRANSLATIONS['en']?.[key] || key;
  };

  // --- ESTADOS DE USABILIDADE E CUSTOMIZAÇÃO ---
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const [accentTheme, setAccentTheme] = useState<string>('violet');
  const [gamificationEnabled, setGamificationEnabled] = useState<boolean>(true);
  const [defaultCalendarView, setDefaultCalendarView] = useState<'month' | 'week' | 'day'>('month');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | null; id: number | null }>({ message: '', type: null, id: null });
  const [calendarYear, setCalendarYear] = useState<number>(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(new Date().getMonth());
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'day'>('month');
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<Date>(new Date());
  const [filterChoreUser, setFilterChoreUser] = useState<string>('all');
  const [filterChoreType, setFilterChoreType] = useState<string>('all');

  // --- NOVOS ESTADOS PREMIUM DO PAINEL ---
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [newStickyText, setNewStickyText] = useState<string>('');
  const [newStickyColor, setNewStickyColor] = useState<'yellow' | 'blue' | 'green' | 'pink' | 'purple'>('yellow');
  const [isAddingSticky, setIsAddingSticky] = useState<boolean>(false);
  const [localBackupsIndex, setLocalBackupsIndex] = useState<any[]>([]);

  // --- ESTADOS PARA LISTA DE COMPRAS E INTELIGÊNCIA ARTIFICIAL (GEMINI) ---
  const [keepItemName, setKeepItemName] = useState<string>('');
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [aiCategorizationEnabled, setAiCategorizationEnabled] = useState<boolean>(true);
  const [itemsBeingClassified, setItemsBeingClassified] = useState<Set<string>>(new Set());
  const [smartSuggestions, setSmartSuggestions] = useState<any[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState<boolean>(false);

  const [isAddingShoppingItem] = useState<boolean>(false);
  const [isEnrichingChore, setIsEnrichingChore] = useState<boolean>(false);
  const [lastEnrichedTitle, setLastEnrichedTitle] = useState<string>('');
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);

  // Estados locais do formulário de ajustes de IA
  const [aiConfigApiKey, setAiConfigApiKey] = useState<string>('');
  const [aiConfigEnabled, setAiConfigEnabled] = useState<boolean>(true);
  const [aiConfigTestItem, setAiConfigTestItem] = useState<string>('');
  const [aiConfigTestResult, setAiConfigTestResult] = useState<string>('');
  const [aiConfigTestLoading, setAiConfigTestLoading] = useState<boolean>(false);
  const [showApiKey, setShowApiKey] = useState<boolean>(false);

  // --- CONSULTAS AO BANCO LOCAL DE DADOS (LIVE QUERIES) ---
  const rawChores = useLiveQuery(() => db.chores.where('deleted').equals(0).toArray());
  const localChores = useMemo(() => rawChores || [], [rawChores]);
  const visibleChores = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'admin') return localChores;
    return localChores.filter(chore => {
      const assigned = chore.assigned_to;
      const coResp = chore.co_responsible;
      const user = currentUser.username;
      return assigned === user || coResp === user || assigned === 'all';
    });
  }, [localChores, currentUser]);

  const rawShopping = useLiveQuery(() => db.shopping.where('deleted').equals(0).toArray());
  const localShopping = useMemo(() => rawShopping || [], [rawShopping]);
  const localRewards = useLiveQuery(() => db.rewards.where('deleted').equals(0).toArray()) || [];
  const rawPoints = useLiveQuery(() => db.points.orderBy('timestamp').toArray());
  const localPoints = useMemo(() => rawPoints || [], [rawPoints]);
  const stickyNotesData = useLiveQuery(() => db.metadata.get('family_sticky_notes'));
  const stickyNotes = useMemo(() => stickyNotesData?.value || [], [stickyNotesData]);

  const liveAiConfig = useLiveQuery(() => db.ai_config.get('current_ai_config'));

  useEffect(() => {
    if (liveAiConfig) {
      Promise.resolve().then(() => {
        setGeminiApiKey(liveAiConfig.gemini_api_key || '');
        setAiCategorizationEnabled(!!liveAiConfig.ai_categorization_enabled);
        setAiConfigApiKey(liveAiConfig.gemini_api_key || '');
        setAiConfigEnabled(!!liveAiConfig.ai_categorization_enabled);
      });
    }
  }, [liveAiConfig]);

  // Obter dias da semana abreviados
  const daysOfWeek = getLocalizedWeekdays(language, 'short');
  const currentDayName = daysOfWeek[new Date().getDay()]; // ex: "Sex"

  // --- CARREGAMENTO DE MEMBROS DA FAMÍLIA ---
  const fetchFamilyMembers = async (customToken?: string, customBackendUrl?: string) => {
    const activeToken = customToken || token;
    const activeUrl = customBackendUrl || backendUrl;

    if (!isOnline || !activeToken) {
      const cached = await db.metadata.get('family_members');
      if (cached) {
        setFamilyMembers(cached.value);
      }
      return;
    }

    try {
      const response = await fetch(`${activeUrl}/api/family/members`, {
        headers: { 'Authorization': `Bearer ${activeToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFamilyMembers(data);
        await db.metadata.put({ key: 'family_members', value: data });

        // Sincronizar dados do usuário logado (ex: role, título) caso tenham mudado no backend
        const storedUser = await db.metadata.get('user_info');
        if (storedUser && storedUser.value) {
          const myUpdatedInfo = data.find((m: any) => m.id === storedUser.value.id);
          if (myUpdatedInfo && (myUpdatedInfo.role !== storedUser.value.role || myUpdatedInfo.family_title !== storedUser.value.family_title)) {
            const newUser = { ...storedUser.value, ...myUpdatedInfo };
            setCurrentUser(newUser);
            await db.metadata.put({ key: 'user_info', value: newUser });
          }
        }
      } else {
        const cached = await db.metadata.get('family_members');
        if (cached) setFamilyMembers(cached.value);
      }
    } catch (err) {
      console.error('Erro ao buscar membros da família:', err);
      const cached = await db.metadata.get('family_members');
      if (cached) setFamilyMembers(cached.value);
    }
  };

  // --- TIMER PARA O RELÓGIO DIGITAL ---
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // --- DETECÇÃO NATIVA DE CONECTIVIDADE DE REDE ---
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast(t('syncStatusOnline') || 'Online', 'success');
      setTimeout(triggerSync, 500);
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast(t('syncStatusOffline') || 'Offline', 'error');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Inicializar de acordo com a conectividade real do navegador
    if (navigator.onLine === false) {
      Promise.resolve().then(() => {
        setIsOnline(false);
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // --- INICIALIZAÇÃO E CARREGAMENTO DE METADADOS ---
  useEffect(() => {
    async function loadAuth() {
      const storedToken = await db.metadata.get('auth_token');
      const storedUser = await db.metadata.get('user_info');
      const storedFamily = await db.metadata.get('family_info');
      const storedUrl = await db.metadata.get('backend_url');
      const storedSync = await db.metadata.get('last_sync_time');
      let currentBackendUrl = DEFAULT_BACKEND_URL;
      if (storedUrl) {
        if (storedUrl.value === 'http://localhost:5000' && !window.location.origin.includes('localhost')) {
          setBackendUrl(window.location.origin);
          currentBackendUrl = window.location.origin;
        } else {
          setBackendUrl(storedUrl.value);
          currentBackendUrl = storedUrl.value;
        }
      }
      if (storedSync) setLastSyncTime(storedSync.value);

      if (storedToken && storedUser && storedFamily) {
        setToken(storedToken.value);
        setCurrentUser(storedUser.value);
        setFamily(storedFamily.value);
        setIsAuth(true);
        // Carregar membros imediatamente
        fetchFamilyMembers(storedToken.value, currentBackendUrl);
      } else {
        // Sem autenticação: limpar estados e forçar login
        setToken(null);
        setCurrentUser(null);
        setFamily(null);
        setIsAuth(false);
        setFamilyMembers([]);
      }
    }
    loadAuth();
  }, []);

  // --- GERENCIAMENTO DE PERMISSÕES DE NOTIFICAÇÃO ---
  const requestNotificationPermission = () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            console.log('Permissão de notificações concedida pelo usuário.');
          }
        });
      }
    }
  };

  // --- TRANSMISSÃO DE NOTIFICAÇÃO REATIVA PARA A FAMÍLIA ---
  const sendFamilyNotification = async (message: string) => {
    if (!isOnline || !token || !family) return;
    try {
      await fetch(`${backendUrl}/api/family/notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message })
      });
    } catch (err) {
      console.error('Erro ao enviar notificação reativa:', err);
    }
  };

  // Solicitar permissões de notificação ao fazer login
  useEffect(() => {
    if (isAuthenticated) {
      requestNotificationPermission();
    }
  }, [isAuthenticated]);

  // --- REGISTRAR CONEXÃO SSE (PUSH REAL-TIME) ---
  useEffect(() => {
    let eventSource: EventSource | null = null;

    if (isAuthenticated && isOnline && token && family) {
      const streamUrl = `${backendUrl}/api/sync/stream?token=${encodeURIComponent(token)}`;
      console.log('Iniciando stream SSE para atualizações em tempo real...');
      
      try {
        eventSource = new EventSource(streamUrl);
        
        eventSource.addEventListener('sync', () => {
          console.log('Alerta SSE recebido! Sincronizando dados...');
          triggerSync();
        });

        eventSource.addEventListener('notification', (event: any) => {
          try {
            const data = JSON.parse(event.data);
            console.log('Notificação familiar recebida via SSE:', data);
            
            // 1. Tocar chime sound sintetizado
            playChimeSound();
            
            // 2. Exibir Glowing Toast na tela
            showToast(data.message, 'success');
            
            // 3. Disparar notificação nativa do SO se o app estiver em segundo plano
            if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
              new Notification('Atualização no FamilySync 🏡', {
                body: data.message,
                icon: '/favicon.png',
                badge: '/favicon.png'
              });
            }
          } catch (e) {
            console.error('Erro ao processar notificação familiar SSE:', e);
          }
        });

        eventSource.addEventListener('reset', async () => {
          console.warn('Alerta SSE de Reset do Banco de Dados recebido! Forçando logout e reinicialização de segurança...');
          try {
            // Limpar todas as tabelas IndexedDB locais de forma assíncrona
            await Promise.all(db.tables.map(table => table.clear().catch(() => {})));
            await db.metadata.clear().catch(() => {});
            // Limpar cache local do localStorage
            localStorage.clear();
            
            // Exibir notificação de encerramento de sessão
            showToast(t('toastDbResetByAdmin'), 'error');
            
            // Redirecionar sutilmente após 2.5 segundos
            setTimeout(() => {
              window.location.reload();
            }, 2500);
          } catch (e) {
            console.error('Erro ao limpar local durante reset SSE:', e);
            window.location.reload();
          }
        });

        eventSource.onerror = (err) => {
          console.error('Erro no canal de transmissão em tempo real (SSE). Reconectando...', err);
        };
      } catch (err) {
        console.error('Falha ao abrir stream SSE:', err);
      }
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [isAuthenticated, isOnline, token, family, backendUrl]);

  // --- DETALHES DE TEMAS DE CORES DISPONÍVEIS ---
  const THEMES: { [key: string]: { primary: string; hover: string } } = {
    violet: { primary: '#8b5cf6', hover: '#a78bfa' },
    emerald: { primary: '#10b981', hover: '#34d399' },
    cyan: { primary: '#06b6d4', hover: '#22d3ee' },
    amber: { primary: '#f59e0b', hover: '#fbbf24' },
    ruby: { primary: '#ef4444', hover: '#f87171' }
  };

  // Carregar tema e visualização do calendário persistidos no IndexedDB
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedTheme = await db.metadata.get('accent_theme');
        if (storedTheme && storedTheme.value) {
          setAccentTheme(storedTheme.value);
        }
        
        const storedLanguage = await db.metadata.get('language');
        if (storedLanguage && storedLanguage.value) {
          setLanguage(storedLanguage.value);
        }
        
        const storedView = await db.metadata.get('default_calendar_view');
        if (storedView && storedView.value) {
          setDefaultCalendarView(storedView.value);
          setCalendarView(storedView.value);
        }

        const storedGamification = await db.metadata.get('gamification_enabled');
        if (storedGamification !== undefined && storedGamification !== null) {
          setGamificationEnabled(storedGamification.value);
        }

        const liveConfig = await db.ai_config.get('current_ai_config');
        if (liveConfig) {
          setGeminiApiKey(liveConfig.gemini_api_key || '');
          setAiConfigApiKey(liveConfig.gemini_api_key || '');
          setAiCategorizationEnabled(!!liveConfig.ai_categorization_enabled);
          setAiConfigEnabled(!!liveConfig.ai_categorization_enabled);
        } else {
          const storedApiKey = await db.metadata.get('gemini_api_key');
          if (storedApiKey && storedApiKey.value !== undefined) {
            setGeminiApiKey(storedApiKey.value);
            setAiConfigApiKey(storedApiKey.value);
          }

          const storedAiEnabled = await db.metadata.get('ai_categorization_enabled');
          if (storedAiEnabled && storedAiEnabled.value !== undefined) {
            setAiCategorizationEnabled(storedAiEnabled.value);
            setAiConfigEnabled(storedAiEnabled.value);
          }
        }

        // Pré-seeding de cache de compras local se estiver vazio
        const cachedKeys = await db.metadata.toArray();
        const hasCache = cachedKeys.some(k => k.key.startsWith('shop_cache:'));
        if (!hasCache) {
          const seeds = [
            { name: 'leite', category: 'Alimentos', correctedName: 'Leite' },
            { name: 'pao', category: 'Alimentos', correctedName: 'Pão' },
            { name: 'arroz', category: 'Alimentos', correctedName: 'Arroz' },
            { name: 'feijao', category: 'Alimentos', correctedName: 'Feijão' },
            { name: 'sabonete', category: 'Higiene', correctedName: 'Sabonete' },
            { name: 'shampoo', category: 'Higiene', correctedName: 'Shampoo' },
            { name: 'detergente', category: 'Limpeza', correctedName: 'Detergente' },
            { name: 'sabao', category: 'Limpeza', correctedName: 'Sabão' },
            { name: 'amaciante', category: 'Limpeza', correctedName: 'Amaciante' },
            { name: 'remedio', category: 'Farmácia', correctedName: 'Remédio' },
            { name: 'paracetamol', category: 'Farmácia', correctedName: 'Paracetamol' },
            { name: 'aspirina', category: 'Farmácia', correctedName: 'Aspirina' },
            { name: 'cafe', category: 'Alimentos', correctedName: 'Café' },
            { name: 'queijo', category: 'Alimentos', correctedName: 'Queijo' },
            { name: 'agua', category: 'Alimentos', correctedName: 'Água' },
            { name: 'sal', category: 'Alimentos', correctedName: 'Sal' },
            { name: 'oleo', category: 'Alimentos', correctedName: 'Óleo' },
            { name: 'fruta', category: 'Alimentos', correctedName: 'Frutas' },
            { name: 'pasta de dente', category: 'Higiene', correctedName: 'Pasta de dente' },
            { name: 'papel higenico', category: 'Higiene', correctedName: 'Papel higiênico' },
            { name: 'papel higienico', category: 'Higiene', correctedName: 'Papel higiênico' },
            { name: 'racao', category: 'Pet', correctedName: 'Ração' },
            { name: 'areia de gato', category: 'Pet', correctedName: 'Areia de gato' },
            { name: 'fralda', category: 'Bebê', correctedName: 'Fraldas' },
            { name: 'lenco umedecido', category: 'Bebê', correctedName: 'Lenço umedecido' },
            { name: 'pilha', category: 'Casa & Utensílios', correctedName: 'Pilhas' },
            { name: 'pilhas', category: 'Casa & Utensílios', correctedName: 'Pilhas' },
            { name: 'lampada', category: 'Casa & Utensílios', correctedName: 'Lâmpada' },
            { name: 'chave de fenda', category: 'Casa & Utensílios', correctedName: 'Chave de fenda' }
          ];
          for (const seed of seeds) {
            await db.metadata.put({ key: 'shop_cache:' + seed.name, value: { category: seed.category, correctedName: seed.correctedName } });
          }
        }
      } catch (err) {
        console.error('Erro ao carregar configurações de tema/visão:', err);
      }
    };
    loadSettings();
  }, []);

  // Verificar se o onboarding já foi concluído (se o usuário admin padrão já foi customizado)
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const response = await fetch(`${backendUrl}/api/auth/onboarding-status`);
        if (response.ok) {
          const data = await response.json();
          setOnboardingCompleted(data.onboardingCompleted);
        }
      } catch (err) {
        console.error('Erro ao verificar status de onboarding:', err);
      }
    };
    checkOnboardingStatus();
  }, [backendUrl]);

  // Aplicar tema dinâmico no DOM ao alterar o estado
  useEffect(() => {
    const selected = THEMES[accentTheme] || THEMES.violet;
    document.documentElement.style.setProperty('--accent-primary', selected.primary);
    document.documentElement.style.setProperty('--accent-primary-hover', selected.hover);
  }, [accentTheme]);

  const handleChangeTheme = async (themeName: string) => {
    setAccentTheme(themeName);
    try {
      await db.metadata.put({ key: 'accent_theme', value: themeName });
      showToast(t('toastThemeUpdated'), 'success');
    } catch (err) {
      console.error('Erro ao salvar tema:', err);
    }
  };

  const handleChangeDefaultCalendarView = async (viewName: 'month' | 'week' | 'day') => {
    setDefaultCalendarView(viewName);
    try {
      await db.metadata.put({ key: 'default_calendar_view', value: viewName });
      showToast(t('toastCalendarViewUpdated'), 'success');
    } catch (err) {
      console.error('Erro ao salvar visualização padrão:', err);
    }
  };

  // --- CONTROLE DE TOASTS DE NOTIFICAÇÃO ---
  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    const id = Date.now();
    setToast({ message, type, id });
  };

  useEffect(() => {
    if (toast.id) {
      const timer = setTimeout(() => {
        setToast({ message: '', type: null, id: null });
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toast.id]);

  // --- SINCRONIZAR CAMPOS DO FORMULÁRIO DE PERFIL COM USUÁRIO ATUAL ---
  useEffect(() => {
    if (currentUser) {
      Promise.resolve().then(() => {
        setProfileUsername(currentUser.username || '');
        setProfileDisplayName(currentUser.display_name || currentUser.username || '');
        setProfileEmail(currentUser.email || '');
        setProfileBirthDate(currentUser.birth_date || '');
        setProfileGender(currentUser.gender || 'Não Informar');
        setProfileFamilyTitle(currentUser.family_title || 'Membro');
      });
    }
  }, [currentUser]);

  // --- SUBMISSÃO DA CONFIGURAÇÃO INICIAL DE SEGURANÇA (REMOÇÃO DO 'admin' PADRÃO) ---
  const handleForcedSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError(null);

    const cleanUsername = setupUsername.trim().toLowerCase().replace(/\s+/g, '');
    const cleanDisplayName = setupDisplayName.trim();

    if (!cleanDisplayName) {
      setSetupError(t('alertDisplayNameEmpty'));
      return;
    }

    if (!cleanUsername) {
      setSetupError(t('alertUsernameEmpty'));
      return;
    }

    if (cleanUsername === 'admin') {
      setSetupError(t('alertUsernameAdmin'));
      return;
    }

    if (!setupPassword || setupPassword.trim().length < 5) {
      setSetupError(t('alertPasswordMin'));
      return;
    }

    setSetupLoading(true);

    try {
      if (isAuthenticated && token) {
        // MODO ONLINE (SERVIDOR REAL)
        const response = await fetch(`${backendUrl}/api/user/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            username: cleanUsername,
            display_name: cleanDisplayName,
            email: `${cleanUsername}@familysync.local`,
            password: setupPassword.trim(),
            birth_date: '',
            gender: '',
            family_title: setupFamilyTitle
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Erro ao redefinir a conta administrativa.');
        }

        // Atualizar estado e IndexedDB local cache
        setCurrentUser(data.user);
        await db.metadata.put({ key: 'user_info', value: data.user });
        if (data.token) {
          setToken(data.token);
          await db.metadata.put({ key: 'auth_token', value: data.token });
        }
        
        showToast(t('toastSetupSuccess'), 'success');
        fetchFamilyMembers(data.token || token, backendUrl);
      } else {
        // MODO SIMULAÇÃO (OFFLINE LOCAL)
        if (!currentUser) return;
        const updatedUser = {
          ...currentUser,
          username: cleanUsername,
          display_name: cleanDisplayName,
          birth_date: '',
          gender: '',
          family_title: setupFamilyTitle
        };
        setCurrentUser(updatedUser);
        await db.metadata.put({ key: 'user_info', value: updatedUser });
        showToast(t('toastSimulationAdminConfigured'), 'success');
      }
    } catch (err: any) {
      setSetupError(err.message);
    } finally {
      setSetupLoading(false);
    }
  };

  // --- SALVAR PERFIL DO USUÁRIO (REAL OU SIMULADO) ---
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaveSuccess(null);
    setProfileSaveError(null);

    if (!profileDisplayName.trim()) {
      setProfileSaveError('O nome de exibição (Nome) não pode ser vazio.');
      return;
    }

    if (!profileUsername.trim()) {
      setProfileSaveError('O nome de usuário não pode ser vazio.');
      return;
    }

    try {
      if (isAuthenticated && token) {
        // MODO ONLINE (SERVIDOR REAL)
        const response = await fetch(`${backendUrl}/api/user/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            username: profileUsername,
            display_name: profileDisplayName,
            email: profileEmail,
            birth_date: profileBirthDate,
            gender: profileGender,
            family_title: profileFamilyTitle,
            password: profilePassword || undefined
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Erro ao atualizar perfil no servidor.');
        }

        // Atualizar estado e IndexedDB local cache
        setCurrentUser(data.user);
        await db.metadata.put({ key: 'user_info', value: data.user });
        if (data.token) {
          setToken(data.token);
          await db.metadata.put({ key: 'auth_token', value: data.token });
        }
        
        setProfileSaveSuccess('Seu perfil foi atualizado com sucesso no servidor!');
        fetchFamilyMembers(data.token || token, backendUrl);
      }
    } catch (err: any) {
      setProfileSaveError(err.message || 'Ocorreu um erro ao salvar o perfil.');
    }
  };

  // --- EXECUÇÃO DO MOTOR DE SINCRONIZAÇÃO BIDIRECIONAL (E2EE CLIENT-SIDE) ---
  async function triggerSync() {
    if (!isOnline) {
      console.log('Sync ignorado: App está operando em Modo Offline simulado.');
      return;
    }
    if (!token || !family) return;

    setIsSyncing(true);
    try {
      // 1. Coletar alterações locais na fila de sincronização
      const queueEntries = await db.sync_queue.toArray();
      const itemsToSync: any[] = [];

      for (const entry of queueEntries) {
        let localItem: any = null;

        // Buscar o item correspondente dependendo da tabela
        if (entry.collection === 'chores') localItem = await db.chores.get(entry.item_id);
        else if (entry.collection === 'shopping') localItem = await db.shopping.get(entry.item_id);
        else if (entry.collection === 'comments') localItem = await db.comments.get(entry.item_id);
        else if (entry.collection === 'rewards') localItem = await db.rewards.get(entry.item_id);
        else if (entry.collection === 'points') localItem = await db.points.get(entry.item_id);
        else if (entry.collection === 'ai_config') localItem = await db.ai_config.get(entry.item_id);
        else if (entry.collection === 'purchase_history') localItem = await db.purchase_history.get(entry.item_id);

        if (localItem) {
          // Armazenar os dados em formato stringificado simples
          const encryptedPayload = JSON.stringify(localItem);
          itemsToSync.push({
            id: localItem.id,
            collection: entry.collection,
            encrypted_data: encryptedPayload,
            updated_at: localItem.updated_at,
            deleted: localItem.deleted || 0
          });
        } else if (entry.operation === 'delete') {
          // Se foi deletado e já excluído localmente
          itemsToSync.push({
            id: entry.item_id,
            collection: entry.collection,
            encrypted_data: '',
            updated_at: entry.updated_at,
            deleted: 1
          });
        }
      }

      // 2. Chamar a API de sincronização do backend
      const response = await fetch(`${backendUrl}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          lastSyncTime: lastSyncTime,
          items: itemsToSync
        })
      });

      if (!response.ok) {
        throw new Error('Falha na comunicação de sincronização com o servidor.');
      }

      const syncResult = await response.json();
      const serverUpdates = syncResult.items;

      // 3. Processar atualizações vindas do servidor
      for (const serverItem of serverUpdates) {
        const { id, collection, encrypted_data, deleted } = serverItem;

        if (deleted === 1) {
          // Item deletado no servidor
          if (collection === 'chores') await db.chores.delete(id);
          else if (collection === 'shopping') await db.shopping.delete(id);
          else if (collection === 'comments') await db.comments.delete(id);
          else if (collection === 'rewards') await db.rewards.delete(id);
          else if (collection === 'points') await db.points.delete(id);
          else if (collection === 'ai_config') await db.ai_config.delete(id);
          else if (collection === 'purchase_history') await db.purchase_history.delete(id);
        } else {
          // Processar item localmente em formato stringificado simples
          try {
            const decryptedItem = JSON.parse(encrypted_data);

            if (collection === 'chores') await db.chores.put(decryptedItem);
            else if (collection === 'shopping') await db.shopping.put(decryptedItem);
            else if (collection === 'comments') await db.comments.put(decryptedItem);
            else if (collection === 'rewards') await db.rewards.put(decryptedItem);
            else if (collection === 'points') await db.points.put(decryptedItem);
            else if (collection === 'purchase_history') await db.purchase_history.put(decryptedItem);
            else if (collection === 'ai_config') {
              await db.ai_config.put(decryptedItem);
              if (decryptedItem.id === 'current_ai_config') {
                setGeminiApiKey(decryptedItem.gemini_api_key || '');
                setAiCategorizationEnabled(!!decryptedItem.ai_categorization_enabled);
                setAiConfigApiKey(decryptedItem.gemini_api_key || '');
                setAiConfigEnabled(!!decryptedItem.ai_categorization_enabled);
              }
            }
          } catch (decErr) {
            console.error('Não foi possível processar o item recebido do servidor:', decErr);
          }
        }
      }

      // 4. Limpar itens sincronizados da fila local e salvar timestamp
      const synchedIds = queueEntries.map(e => e.id);
      await db.sync_queue.bulkDelete(synchedIds);

      const serverTime = syncResult.serverTime;
      setLastSyncTime(serverTime);
      await db.metadata.put({ key: 'last_sync_time', value: serverTime });

      console.log('Sincronização offline-first concluída com sucesso!');
      fetchFamilyMembers();
    } catch (err) {
      console.error('Erro durante a sincronização automática:', err);
    } finally {
      setIsSyncing(false);
    }
  }

  // Sincronizar periodicamente se estiver online
  useEffect(() => {
    let interval: any = null;
    if (isAuthenticated && isOnline) {
      triggerSync(); // Sincronização inicial imediata
      interval = setInterval(triggerSync, 60000); // A cada 60s
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAuthenticated, isOnline]);

  // Intervalo periódico de processamento de itens de compras pendentes de classificação de IA (a cada 15s)
  useEffect(() => {
    let intervalId: any = null;
    if (isAuthenticated && isOnline && aiCategorizationEnabled && geminiApiKey) {
      processPendingShoppingItems();
      intervalId = setInterval(processPendingShoppingItems, 15000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isAuthenticated, isOnline, aiCategorizationEnabled, geminiApiKey]);

  // Trigger do processamento de itens de compra pendentes após 4 segundos da adição (debounce)
  useEffect(() => {
    const pendingCount = localShopping.filter(item => item.ai_status === 'pending').length;
    if (pendingCount === 0 || !isAuthenticated || !isOnline || !aiCategorizationEnabled || !geminiApiKey) return;

    const handler = setTimeout(() => {
      processPendingShoppingItems();
    }, 4000);

    return () => {
      clearTimeout(handler);
    };
  }, [localShopping, isAuthenticated, isOnline, aiCategorizationEnabled, geminiApiKey]);

  // Carregar sugestões salvas em cache ao entrar na aba de compras ou gerar novas
  useEffect(() => {
    if (activeTab === 'shopping') {
      db.metadata.get('shop_recommendations').then(entry => {
        if (entry && entry.value) {
          setSmartSuggestions(entry.value);
        } else {
          generateSmartPurchaseSuggestions();
        }
      });
    }
  }, [activeTab, localShopping]);


  // --- FLUXOS DE AUTENTICAÇÃO E CONFIGURAÇÃO DA CHAVE E2EE ---

  // Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const response = await fetch(`${backendUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Falha ao efetuar login.');
      }

      await db.metadata.put({ key: 'auth_token', value: data.token });
      await db.metadata.put({ key: 'user_info', value: data.user });
      await db.metadata.put({ key: 'family_info', value: data.family });

      setToken(data.token);
      setCurrentUser(data.user);
      setFamily(data.family);
      setIsAuth(true);
      fetchFamilyMembers(data.token, backendUrl);
    } catch (err: any) {
      setAuthError(err.message);
    }
  };


  // Logout
  const handleLogout = async () => {
    await db.metadata.delete('auth_token');
    await db.metadata.delete('user_info');
    await db.metadata.delete('family_info');
    await db.metadata.delete('last_sync_time');
    setIsAuth(false);
    setToken(null);
    setCurrentUser(null);
    setFamily(null);
    window.location.reload();
  };

  // --- OPERAÇÕES DO MURAL DE AVISOS DA FAMÍLIA (STICKY NOTES) ---
  const handleAddStickyNote = async () => {
    if (!newStickyText.trim()) return;

    const newNote = {
      id: generateUUID(),
      text: newStickyText.trim(),
      sender: currentUser ? currentUser.username : 'Membro',
      color: newStickyColor,
      timestamp: Date.now()
    };

    const currentNotes = [...stickyNotes, newNote];
    await db.metadata.put({ key: 'family_sticky_notes', value: currentNotes });
    setNewStickyText('');
    setIsAddingSticky(false);
    showToast(t('toastStickyNotePublished'), 'success');
  };

  const handleDeleteStickyNote = async (id: string) => {
    const currentNotes = stickyNotes.filter((note: any) => note.id !== id);
    await db.metadata.put({ key: 'family_sticky_notes', value: currentNotes });
    showToast(t('toastStickyNoteRemoved'), 'info');
  };

  // --- OPERAÇÕES DA APP (METODOS COM FILA DE SYNC SE ESTIVER OFFLINE) ---

  // Concluir uma Tarefa/Remédio (Compatível com Conclusão por Dia / Recorrente)
  const handleCompleteChore = async (choreId: string, dateStr?: string) => {
    const userName = currentUser ? currentUser.username : 'Membro';
    const userId = currentUser ? currentUser.id : 'demo-user';
    
    const chore = await db.chores.get(choreId);
    if (!chore) return;

    const targetDate = dateStr || getTodayStr();
    const isCompleted = isChoreCompletedOnDate(chore, targetDate);
    const now = Date.now();

    if (!isCompleted) {
      // Marcar como concluída para esta data
      const updatedDates = chore.completed_dates ? [...chore.completed_dates] : [];
      if (!updatedDates.includes(targetDate)) {
        updatedDates.push(targetDate);
      }

      await db.chores.update(choreId, {
        completed_by: userName,
        completed_at: now,
        completed_dates: updatedDates,
        updated_at: now
      });

      // Lançar pontos na gamificação
      const ptId = generateUUID();
      const newPoint: PointLog = {
        id: ptId,
        collection: 'points',
        user_id: userId,
        user_name: userName,
        points: chore.points_worth,
        reason: `${chore.is_medication ? 'Tomou' : 'Concluiu'}: ${chore.title}`,
        timestamp: now,
        updated_at: now
      };
      await db.points.put(newPoint);

      // Enfileirar sincronização se autenticado
      if (isAuthenticated) {
        await queueSyncOperation(choreId, 'chores', 'update');
        await queueSyncOperation(ptId, 'points', 'insert');
        triggerSync();
        const notifMsg = chore.is_medication
          ? t('notifMedicationTaken')
              .replace('{user}', currentUser?.display_name || userName)
              .replace('{title}', chore.title)
              .replace('{points}', chore.points_worth.toString())
          : t('notifChoreCompleted')
              .replace('{user}', currentUser?.display_name || userName)
              .replace('{title}', chore.title)
              .replace('{points}', chore.points_worth.toString());
        sendFamilyNotification(notifMsg);
      }
    } else {
      // Desmarcar para esta data
      const updatedDates = chore.completed_dates ? chore.completed_dates.filter(d => d !== targetDate) : [];
      const hasAnyDateLeft = updatedDates.length > 0;

      await db.chores.update(choreId, {
        completed_by: hasAnyDateLeft ? chore.completed_by : null,
        completed_at: hasAnyDateLeft ? chore.completed_at : null,
        completed_dates: updatedDates,
        updated_at: now
      });

      if (isAuthenticated) {
        await queueSyncOperation(choreId, 'chores', 'update');
        triggerSync();
      }
    }
  };

  // Criar Nova Tarefa / Remédio com Suporte Google Calendar & Ciclo Sequencial de Medicamento
  const [showChoreFormModal, setShowChoreFormModal] = useState<boolean>(false);
  const [resetPasswordMemberId, setResetPasswordMemberId] = useState<string | null>(null);
  const [resetPasswordNewValue, setResetPasswordNewValue] = useState<string>('');
  const [newChoreTitle, setNewChoreTitle] = useState<string>('');
  const [newChoreDesc, setNewChoreDesc] = useState<string>('');
  const [newChoreAssigned, setNewChoreAssigned] = useState<string>('all');
  const [newChorePoints, setNewChorePoints] = useState<number>(30);
  const [newChoreIsMed, setNewChoreIsMed] = useState<boolean>(false);

  // Estados Google Calendar e de Horário
  const [newChoreStartDate, setNewChoreStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newChoreEndDate, setNewChoreEndDate] = useState<string>('');
  const [newChoreRepeats, setNewChoreRepeats] = useState<boolean>(false);
  const [newChoreRecurrenceType, setNewChoreRecurrenceType] = useState<'daily' | 'weekly' | 'monthly' | 'custom_days'>('daily');
  const [newChoreRecurrenceInterval, setNewChoreRecurrenceInterval] = useState<number>(1);
  const [newChoreRecurrenceDays, setNewChoreRecurrenceDays] = useState<string[]>([]);
  const [newChoreCoResponsible, setNewChoreCoResponsible] = useState<string>('none');

  // Horário
  const [newChoreTimeType, setNewChoreTimeType] = useState<'all_day' | 'fixed' | 'period'>('all_day');
  const [newChoreFixedTime, setNewChoreFixedTime] = useState<string>('08:00');
  const [newChorePeriodTime, setNewChorePeriodTime] = useState<'manha' | 'tarde' | 'noite'>('manha');

  // Ciclo de dosagens (medicamento)
  const [newChoreMedCycle, setNewChoreMedCycle] = useState<string[]>(['1 dose']);
  const [newChoreMedFrequency, setNewChoreMedFrequency] = useState<string>('1'); // '1' = 1x/dia, '2' = a cada 12h, '3' = a cada 8h, '4' = a cada 6h
  const [newChoreMedDuration, setNewChoreMedDuration] = useState<number>(7); // dias de tratamento

  const resetChoreForm = () => {
    setNewChoreTitle('');
    setNewChoreDesc('');
    if (currentUser && currentUser.role !== 'admin') {
      setNewChoreAssigned(currentUser.username);
    } else {
      setNewChoreAssigned('all');
    }
    setNewChorePoints(30);
    setNewChoreIsMed(false);
    setNewChoreStartDate(new Date().toISOString().split('T')[0]);
    setNewChoreEndDate('');
    setNewChoreRepeats(false);
    setNewChoreRecurrenceType('daily');
    setNewChoreRecurrenceInterval(1);
    setNewChoreRecurrenceDays([]);
    setNewChoreCoResponsible('none');
    setNewChoreTimeType('all_day');
    setNewChoreFixedTime('08:00');
    setNewChorePeriodTime('manha');
    setNewChoreMedCycle(['1 dose']);
    setNewChoreMedFrequency('1');
    setNewChoreMedDuration(7);
    setEditingChore(null);
  };

  const handleEditChoreClick = (chore: Chore) => {
    const isAdmin = currentUser?.role === 'admin';
    const isOwner = currentUser && (chore.assigned_to === currentUser.username || chore.co_responsible === currentUser.username);
    
    if (!isAdmin && !isOwner) {
      showToast(t('toastChoreEditPermission'), 'error');
      return;
    }

    setNewChoreTitle(chore.title || '');
    setNewChoreDesc(chore.description || '');
    setNewChoreAssigned(chore.assigned_to || 'all');
    setNewChorePoints(chore.points_worth || 30);
    setNewChoreIsMed(!!chore.is_medication);
    setNewChoreStartDate(chore.start_date || new Date().toISOString().split('T')[0]);
    setNewChoreEndDate(chore.end_date || '');
    setNewChoreRepeats(!!chore.repeats);
    setNewChoreRecurrenceType(chore.recurrence_type || 'daily');
    setNewChoreRecurrenceInterval(chore.recurrence_interval || 1);
    setNewChoreRecurrenceDays(chore.recurrence_days || []);
    setNewChoreCoResponsible(chore.co_responsible || 'none');
    setNewChoreTimeType(chore.time_type || 'all_day');
    setNewChoreFixedTime(chore.fixed_time || '08:00');
    setNewChorePeriodTime(chore.period_time || 'manha');
    setNewChoreMedCycle(chore.medication_cycle || ['1 dose']);
    setEditingChore(chore);
    setShowChoreFormModal(true);
  };

  const handleDeleteChore = async (choreId: string) => {
    try {
      const chore = await db.chores.get(choreId);
      if (chore) {
        const isAdmin = currentUser?.role === 'admin';
        const isOwner = currentUser && (chore.assigned_to === currentUser.username || chore.co_responsible === currentUser.username);
        
        if (!isAdmin && !isOwner) {
          showToast(t('toastChoreDeletePermission'), 'error');
          return;
        }
      }

      const now = Date.now();
      await db.chores.update(choreId, { deleted: 1, updated_at: now });
      if (isAuthenticated) {
        await queueSyncOperation(choreId, 'chores', 'update');
        triggerSync();
      }
      showToast(t('toastChoreDeletedSuccess'), 'success');
      resetChoreForm();
      setShowChoreFormModal(false);
    } catch (err) {
      console.error('Erro ao excluir atividade:', err);
      showToast(t('toastChoreDeleteError'), 'error');
    }
  };

  const handleCreateChore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChoreTitle) return;

    const now = Date.now();

    if (editingChore) {
      if (!editingChore.repeats) {
        // Edit in-place for single occurrences
        const updatedChore: Chore = {
          ...editingChore,
          title: newChoreTitle,
          description: newChoreDesc,
          assigned_to: newChoreAssigned,
          frequency: newChoreRecurrenceType === 'custom_days' ? 'custom' : (newChoreRecurrenceType === 'weekly' ? 'weekly' : 'daily'),
          is_medication: newChoreIsMed,
          points_worth: Number(newChorePoints),
          updated_at: now,
          start_date: newChoreStartDate || new Date().toISOString().split('T')[0],
          end_date: newChoreEndDate || null,
          repeats: newChoreRepeats,
          recurrence_type: newChoreRecurrenceType,
          recurrence_interval: Number(newChoreRecurrenceInterval) || 1,
          recurrence_days: newChoreRecurrenceType === 'custom_days' ? newChoreRecurrenceDays : [],
          co_responsible: newChoreCoResponsible,
          time_type: newChoreTimeType,
          fixed_time: newChoreTimeType === 'fixed' ? newChoreFixedTime : undefined,
          period_time: newChoreTimeType === 'period' ? newChorePeriodTime : undefined,
          medication_cycle: newChoreIsMed ? (newChoreMedCycle.length > 0 ? newChoreMedCycle : ['1 dose']) : undefined
        };

        if (newChoreIsMed) {
          updatedChore.medication_dosages = {
            'Seg': newChoreMedCycle[0] || '1 dose',
            'Ter': newChoreMedCycle[0] || '1 dose',
            'Qua': newChoreMedCycle[0] || '1 dose',
            'Qui': newChoreMedCycle[0] || '1 dose',
            'Sex': newChoreMedCycle[0] || '1 dose',
            'Sáb': newChoreMedCycle[0] || '1 dose',
            'Dom': newChoreMedCycle[0] || '1 dose'
          };
        }

        await db.chores.put(updatedChore);
        if (isAuthenticated) {
          await queueSyncOperation(editingChore.id, 'chores', 'update');
          triggerSync();
        }
      } else {
        // Smart Editing with Recurrence Split (affect future only)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        // 1. Expire old chore to yesterday
        await db.chores.update(editingChore.id, {
          end_date: yesterdayStr,
          updated_at: now
        });
        if (isAuthenticated) {
          await queueSyncOperation(editingChore.id, 'chores', 'update');
        }

        // 2. Clone a new chore starting today
        const newId = generateUUID();
        const clonedChore: Chore = {
          id: newId,
          collection: 'chores',
          title: newChoreTitle,
          description: newChoreDesc,
          assigned_to: newChoreAssigned,
          frequency: newChoreRecurrenceType === 'custom_days' ? 'custom' : (newChoreRecurrenceType === 'weekly' ? 'weekly' : 'daily'),
          is_medication: newChoreIsMed,
          points_worth: Number(newChorePoints),
          updated_at: now,
          deleted: 0,
          start_date: newChoreStartDate || getTodayStr(),
          end_date: newChoreEndDate || null,
          repeats: newChoreRepeats,
          recurrence_type: newChoreRecurrenceType,
          recurrence_interval: Number(newChoreRecurrenceInterval) || 1,
          recurrence_days: newChoreRecurrenceType === 'custom_days' ? newChoreRecurrenceDays : [],
          co_responsible: newChoreCoResponsible,
          time_type: newChoreTimeType,
          fixed_time: newChoreTimeType === 'fixed' ? newChoreFixedTime : undefined,
          period_time: newChoreTimeType === 'period' ? newChorePeriodTime : undefined,
          medication_cycle: newChoreIsMed ? (newChoreMedCycle.length > 0 ? newChoreMedCycle : ['1 dose']) : undefined
        };

        if (newChoreIsMed) {
          clonedChore.medication_dosages = {
            'Seg': newChoreMedCycle[0] || '1 dose',
            'Ter': newChoreMedCycle[0] || '1 dose',
            'Qua': newChoreMedCycle[0] || '1 dose',
            'Qui': newChoreMedCycle[0] || '1 dose',
            'Sex': newChoreMedCycle[0] || '1 dose',
            'Sáb': newChoreMedCycle[0] || '1 dose',
            'Dom': newChoreMedCycle[0] || '1 dose'
          };
        }

        await db.chores.put(clonedChore);
        if (isAuthenticated) {
          await queueSyncOperation(newId, 'chores', 'insert');
          triggerSync();
        }
      }
    } else {
      // Creation mode
      if (newChoreIsMed) {
        // Modo agendamento inteligente de medicamentos com cascata de doses e duração calculada
        const times: string[] = [];
        if (newChoreMedFrequency === '1') {
          times.push(newChoreFixedTime || '08:00');
        } else if (newChoreMedFrequency === '2') {
          times.push('08:00', '20:00');
        } else if (newChoreMedFrequency === '3') {
          times.push('08:00', '16:00', '00:00');
        } else if (newChoreMedFrequency === '4') {
          times.push('06:00', '12:00', '18:00', '00:00');
        } else {
          times.push(newChoreFixedTime || '08:00');
        }

        // Calcular end_date de término do tratamento (start_date + duração - 1 dias)
        const startStr = newChoreStartDate || getTodayStr();
        const durationDays = Number(newChoreMedDuration) || 7;
        const calcEndDate = addDaysToDateStr(startStr, durationDays - 1);

        for (const t of times) {
          const doseId = generateUUID();
          const doseChore: Chore = {
            id: doseId,
            collection: 'chores',
            title: times.length > 1 ? `${newChoreTitle} (${t})` : newChoreTitle,
            description: newChoreDesc || `Tratamento de medicamento: ${newChoreTitle} às ${t}`,
            assigned_to: newChoreAssigned,
            frequency: 'daily',
            is_medication: true,
            points_worth: Number(newChorePoints),
            updated_at: now,
            deleted: 0,
            start_date: startStr,
            end_date: calcEndDate,
            repeats: true,
            recurrence_type: 'daily',
            recurrence_interval: 1,
            recurrence_days: [],
            co_responsible: newChoreCoResponsible,
            time_type: 'fixed',
            fixed_time: t,
            medication_cycle: newChoreMedCycle.length > 0 ? newChoreMedCycle : ['1 dose'],
            medication_dosages: {
              'Seg': newChoreMedCycle[0] || '1 dose',
              'Ter': newChoreMedCycle[0] || '1 dose',
              'Qua': newChoreMedCycle[0] || '1 dose',
              'Qui': newChoreMedCycle[0] || '1 dose',
              'Sex': newChoreMedCycle[0] || '1 dose',
              'Sáb': newChoreMedCycle[0] || '1 dose',
              'Dom': newChoreMedCycle[0] || '1 dose'
            }
          };

          await db.chores.put(doseChore);
          if (isAuthenticated) {
            await queueSyncOperation(doseId, 'chores', 'insert');
          }
        }
        
        if (isAuthenticated) {
          triggerSync();
        }
      } else {
        // Normal Chore creation mode
        const id = generateUUID();
        const newChore: Chore = {
          id,
          collection: 'chores',
          title: newChoreTitle,
          description: newChoreDesc,
          assigned_to: newChoreAssigned,
          frequency: newChoreRecurrenceType === 'custom_days' ? 'custom' : (newChoreRecurrenceType === 'weekly' ? 'weekly' : 'daily'),
          is_medication: false,
          points_worth: Number(newChorePoints),
          updated_at: now,
          deleted: 0,
          start_date: newChoreStartDate || getTodayStr(),
          end_date: newChoreEndDate || null,
          repeats: newChoreRepeats,
          recurrence_type: newChoreRecurrenceType,
          recurrence_interval: Number(newChoreRecurrenceInterval) || 1,
          recurrence_days: newChoreRecurrenceType === 'custom_days' ? newChoreRecurrenceDays : [],
          co_responsible: newChoreCoResponsible,
          time_type: newChoreTimeType,
          fixed_time: newChoreTimeType === 'fixed' ? newChoreFixedTime : undefined,
          period_time: newChoreTimeType === 'period' ? newChorePeriodTime : undefined
        };

        await db.chores.put(newChore);
        if (isAuthenticated) {
          await queueSyncOperation(id, 'chores', 'insert');
          triggerSync();
        }
      }
    }

    resetChoreForm();
    setShowChoreFormModal(false);
  };

  // Handler do evento de blur do título de tarefas para autocompletar e enriquecer os dados (Cache-First -> Gemini -> Histórico)
  const handleChoreTitleBlur = async () => {
    // Apenas autocompletar em modo de criação (não sobrescrever edições manuais em tarefas existentes)
    if (editingChore) return;

    const rawTitle = newChoreTitle.trim();
    if (!rawTitle) return;

    // Evita chamadas repetidas desnecessárias com o mesmo texto
    if (rawTitle === lastEnrichedTitle) return;

    const normalized = rawTitle
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

    setLastEnrichedTitle(rawTitle);

    try {
      // 1. Tentar buscar no Cache Local do IndexedDB
      const cacheEntry = await db.metadata.get('chore_cache:' + normalized);
      if (cacheEntry && cacheEntry.value) {
        const val = cacheEntry.value;
        if (val.tituloCorrigido) {
          setNewChoreTitle(val.tituloCorrigido);
          setLastEnrichedTitle(val.tituloCorrigido);
        }
        setNewChoreDesc(val.description || '');
        setNewChorePoints(val.points_worth !== undefined ? Number(val.points_worth) : 30);
        setNewChoreIsMed(!!val.is_medication);
        setNewChoreRepeats(!!val.repeats);
        setNewChoreRecurrenceType(val.recurrence_type || 'daily');
        setNewChoreTimeType(val.time_type || 'all_day');
        setNewChoreFixedTime(val.fixed_time || '08:00');
        setNewChorePeriodTime(val.period_time || 'manha');
        if (val.is_medication) {
          setNewChoreMedCycle(val.medication_cycle || ['1 dose']);
        }
        showToast(t('toastTaskSuggestionsLocal'), 'success');
        return;
      }

      // 2. Se a IA estiver ativa e houver chave, consultar o Gemini
      if (aiCategorizationEnabled && geminiApiKey) {
        setIsEnrichingChore(true);
        try {
          const res = await fetchRefinedChoreFromGemini(rawTitle, geminiApiKey);
          
          if (res.tituloCorrigido) {
            setNewChoreTitle(res.tituloCorrigido);
            setLastEnrichedTitle(res.tituloCorrigido);
          }
          setNewChoreDesc(res.description);
          setNewChorePoints(res.points_worth);
          setNewChoreIsMed(res.is_medication);
          setNewChoreRepeats(res.repeats);
          setNewChoreRecurrenceType(res.recurrence_type);
          setNewChoreTimeType(res.time_type);
          setNewChoreFixedTime(res.fixed_time);
          setNewChorePeriodTime(res.period_time);
          if (res.is_medication) {
            setNewChoreMedCycle(['1 dose']);
          }

          // Gravar no Cache de Metadados Local para agilizar re-entradas
          await db.metadata.put({
            key: 'chore_cache:' + normalized,
            value: {
              tituloCorrigido: res.tituloCorrigido,
              description: res.description,
              points_worth: res.points_worth,
              is_medication: res.is_medication,
              repeats: res.repeats,
              recurrence_type: res.recurrence_type,
              time_type: res.time_type,
              fixed_time: res.fixed_time,
              period_time: res.period_time
            }
          });

          showToast(t('toastFieldsAutoFilled'), 'success');
        } catch (err: any) {
          console.error('Erro ao enriquecer tarefa com Gemini:', err);
          showToast(t('toastChoreClassificationError').replace('{error}', err.message || t('toastNetworkError')), 'error');
          await runFallbackEnrichment(normalized);
        } finally {
          setIsEnrichingChore(false);
        }
      } else {
        // Sem IA ativa, usar fluxo de fallback histórico ou regras estáticas locais
        await runFallbackEnrichment(normalized);
      }
    } catch (err) {
      console.error('Erro no handler handleChoreTitleBlur:', err);
    }
  };

  // Função auxiliar de Fallback de histórico e regras estáticas locais
  const runFallbackEnrichment = async (normalized: string) => {
    // 3. Tentar carregar do histórico local de tarefas (db.chores)
    const pastChore = await getPastChoreDetails(normalized);
    if (pastChore) {
      setNewChoreTitle(pastChore.title);
      setLastEnrichedTitle(pastChore.title);
      setNewChoreDesc(pastChore.description || '');
      setNewChorePoints(pastChore.points_worth !== undefined ? Number(pastChore.points_worth) : 30);
      setNewChoreIsMed(!!pastChore.is_medication);
      setNewChoreRepeats(!!pastChore.repeats);
      setNewChoreRecurrenceType(pastChore.recurrence_type || 'daily');
      setNewChoreTimeType(pastChore.time_type || 'all_day');
      setNewChoreFixedTime(pastChore.fixed_time || '08:00');
      setNewChorePeriodTime(pastChore.period_time || 'manha');
      if (pastChore.is_medication) {
        setNewChoreMedCycle(pastChore.medication_cycle || ['1 dose']);
      }

      // Salva no cache para acesso instantâneo
      await db.metadata.put({
        key: 'chore_cache:' + normalized,
        value: {
          tituloCorrigido: pastChore.title,
          description: pastChore.description || '',
          points_worth: pastChore.points_worth !== undefined ? Number(pastChore.points_worth) : 30,
          is_medication: !!pastChore.is_medication,
          repeats: !!pastChore.repeats,
          recurrence_type: pastChore.recurrence_type || 'daily',
          time_type: pastChore.time_type || 'all_day',
          fixed_time: pastChore.fixed_time || '08:00',
          period_time: pastChore.period_time || 'manha'
        }
      });

      showToast(t('toastChoreHistorySuggested'), 'info');
    } else {
      // 4. Sem histórico local, aplicar heurísticas estáticas simples
      const medKeywords = ['remedio', 'medicacao', 'paracetamol', 'dipirona', 'ibuprofeno', 'dose', 'tomar', 'aspirina', 'vitamina', 'ritalina', 'comprimido', 'gotas'];
      const isMed = medKeywords.some(kw => normalized.includes(kw));

      if (isMed) {
        setNewChoreDesc('Tomar medicação recomendada.');
        setNewChorePoints(10);
        setNewChoreIsMed(true);
        setNewChoreRepeats(true);
        setNewChoreRecurrenceType('daily');
        setNewChoreMedCycle(['1 dose']);
      } else {
        // Manter valores padrão mas resetar campo de descrição se estiver vazio
        setNewChorePoints(30);
        setNewChoreIsMed(false);
      }
    }
  };



  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  // Handler de adição rápida de item (Estilo Google Keep) - IA em tempo real com Cache Local no IndexedDB
  const handleKeepAddShoppingItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keepItemName.trim() || isAddingShoppingItem) return;

    const rawInput = keepItemName.trim();
    const { name, quantity } = parseQuantityAndName(rawInput);
    
    // Verifica se a quantidade fornecida é puramente numérica (ou seja, sem unidade de medida especificada)
    // ex: "4" em "4 bananas" ou "4.5" em "4.5 laranjas"
    const isPurelyNumeric = /^\s*\d+(?:\.\d+)?\s*$/.test(quantity.trim());

    // Normalizar o nome para busca no cache
    const normalizeText = (str: string): string => {
      return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
    };
    const nameNormalized = normalizeText(name);

    const id = generateUUID();
    const now = Date.now();
    const adderName = currentUser ? currentUser.username : 'Membro';

    // Verificar se existe no cache local
    const cacheEntry = await db.metadata.get('shop_cache:' + nameNormalized);

    if (cacheEntry && cacheEntry.value) {
      // ENCONTROU NO CACHE LOCAL! Adiciona instantaneamente com os dados do cache
      const { category, correctedName, defaultUnit } = cacheEntry.value;

      let finalQuantity = quantity;
      if (isPurelyNumeric) {
        // Obter unidade de medida ideal: cache -> histórico -> fallback padrão "un"
        const unit = defaultUnit || (await getPastUnit(nameNormalized)) || 'un';
        finalQuantity = `${quantity.trim()} ${unit}`;

        // Se o cache local existia mas não possuía a unidade de medida salva ainda, atualiza o cache
        if (!defaultUnit) {
          await db.metadata.put({
            key: 'shop_cache:' + nameNormalized,
            value: { ...cacheEntry.value, defaultUnit: unit }
          });
        }
      }

      const newItem: ShoppingItem = {
        id,
        collection: 'shopping',
        name: correctedName,
        quantity: finalQuantity,
        category,
        added_by: adderName,
        checked: 0,
        updated_at: now,
        deleted: 0,
        ai_status: 'processed'
      };

      await db.shopping.put(newItem);

      if (isAuthenticated) {
        await queueSyncOperation(id, 'shopping', 'insert');
        triggerSync();
        sendFamilyNotification(
          t('notifShoppingItemAdded')
            .replace('{user}', currentUser?.display_name || adderName)
            .replace('{name}', correctedName)
            .replace('{quantity}', finalQuantity)
        );
      }

      setKeepItemName('');
      setShowSuggestions(false);
    } else {
      // NÃO ENCONTROU NO CACHE LOCAL! Adiciona imediatamente como pendente para processamento assíncrono
      const defaultUnit = (await getPastUnit(nameNormalized)) || 'un';

      let finalQuantity = quantity;
      if (isPurelyNumeric) {
        finalQuantity = `${quantity.trim()} ${defaultUnit}`;
      }

      const newItem: ShoppingItem = {
        id,
        collection: 'shopping',
        name: name, // Nome original raw, corrigido depois em segundo plano
        quantity: finalQuantity,
        category: 'Sem categoria',
        added_by: adderName,
        checked: 0,
        updated_at: now,
        deleted: 0,
        ai_status: 'pending'
      };

      await db.shopping.put(newItem);

      if (isAuthenticated) {
        await queueSyncOperation(id, 'shopping', 'insert');
        triggerSync();
        sendFamilyNotification(
          t('notifShoppingItemAdded')
            .replace('{user}', currentUser?.display_name || adderName)
            .replace('{name}', name)
            .replace('{quantity}', finalQuantity)
        );
      }

      setKeepItemName('');
      setShowSuggestions(false);
    }
  };

  // Handler de adição rápida de item no Modo Geladeira (Fridge Mode) com Cache e IA
  const handleFridgeAddShoppingItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fridgeShoppingInput.trim() || isAddingShoppingItem) return;

    const rawInput = fridgeShoppingInput.trim();
    const { name, quantity } = parseQuantityAndName(rawInput);
    const isPurelyNumeric = /^\s*\d+(?:\.\d+)?\s*$/.test(quantity.trim());

    // Normalizar o nome para busca no cache
    const normalizeText = (str: string): string => {
      return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
    };
    const nameNormalized = normalizeText(name);

    const id = generateUUID();
    const now = Date.now();
    const adderName = currentUser ? currentUser.username : 'Membro';

    // Verificar se existe no cache local
    const cacheEntry = await db.metadata.get('shop_cache:' + nameNormalized);

    if (cacheEntry && cacheEntry.value) {
      const { category, correctedName, defaultUnit } = cacheEntry.value;

      let finalQuantity = quantity;
      if (isPurelyNumeric) {
        const unit = defaultUnit || (await getPastUnit(nameNormalized)) || 'un';
        finalQuantity = `${quantity.trim()} ${unit}`;

        if (!defaultUnit) {
          await db.metadata.put({
            key: 'shop_cache:' + nameNormalized,
            value: { ...cacheEntry.value, defaultUnit: unit }
          });
        }
      }

      const newItem: ShoppingItem = {
        id,
        collection: 'shopping',
        name: correctedName,
        quantity: finalQuantity,
        category,
        added_by: adderName,
        checked: 0,
        updated_at: now,
        deleted: 0,
        ai_status: 'processed'
      };

      await db.shopping.put(newItem);

      if (isAuthenticated) {
        await queueSyncOperation(id, 'shopping', 'insert');
        triggerSync();
        sendFamilyNotification(
          t('notifShoppingItemAddedFridge')
            .replace('{user}', currentUser?.display_name || adderName)
            .replace('{name}', correctedName)
            .replace('{quantity}', finalQuantity)
        );
      }

      setFridgeShoppingInput('');
      showToast(t('toastChoreAddedSuccess').replace('{name}', correctedName), 'success');
    } else {
      // NÃO ENCONTROU NO CACHE LOCAL! Adiciona imediatamente como pendente no modo Geladeira
      const defaultUnit = (await getPastUnit(nameNormalized)) || 'un';

      let finalQuantity = quantity;
      if (isPurelyNumeric) {
        finalQuantity = `${quantity.trim()} ${defaultUnit}`;
      }

      const newItem: ShoppingItem = {
        id,
        collection: 'shopping',
        name: name,
        quantity: finalQuantity,
        category: 'Sem categoria',
        added_by: adderName,
        checked: 0,
        updated_at: now,
        deleted: 0,
        ai_status: 'pending'
      };

      await db.shopping.put(newItem);

      if (isAuthenticated) {
        await queueSyncOperation(id, 'shopping', 'insert');
        triggerSync();
        sendFamilyNotification(
          t('notifShoppingItemAddedFridge')
            .replace('{user}', currentUser?.display_name || adderName)
            .replace('{name}', name)
            .replace('{quantity}', finalQuantity)
        );
      }

      setFridgeShoppingInput('');
      showToast(t('toastChoreAddedSuccess').replace('{name}', name), 'success');
    }
  };

  // Handler para quando o usuário seleciona uma sugestão do autocomplete na busca rápida
  const handleQuickAddSuggestion = async (suggest: any) => {
    if (!suggest) return;

    const id = generateUUID();
    const now = Date.now();
    const adderName = currentUser ? currentUser.username : 'Membro';

    // Normalizar nome da sugestão para consulta no cache
    const normalizeText = (str: string): string => {
      return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
    };
    const nameNormalized = normalizeText(suggest.name);

    // Verificar se existe correção no cache local
    const cacheEntry = await db.metadata.get('shop_cache:' + nameNormalized);
    const category = cacheEntry?.value?.category || suggest.category || 'Sem categoria';
    const correctedName = cacheEntry?.value?.correctedName || suggest.name;

    const newItem: ShoppingItem = {
      id,
      collection: 'shopping',
      name: correctedName,
      quantity: suggest.quantity || '1 un',
      category: category,
      added_by: adderName,
      checked: 0,
      updated_at: now,
      deleted: 0,
      ai_status: 'processed'
    };

    await db.shopping.put(newItem);

    if (isAuthenticated) {
      await queueSyncOperation(id, 'shopping', 'insert');
      triggerSync();
      sendFamilyNotification(
        t('notifShoppingItemAdded')
          .replace('{user}', currentUser?.display_name || adderName)
          .replace('{name}', correctedName)
          .replace('{quantity}', suggest.quantity || '1 un')
      );
    }

    setKeepItemName('');
    setShowSuggestions(false);
  };

  // --- DRAG & DROP PARA LISTA DE COMPRAS ---
  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    e.dataTransfer.setData('text/plain', itemId);
    setDraggingItemId(itemId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnd = () => {
    setDraggingItemId(null);
    setDragOverCategory(null);
  };

  const handleDrop = async (e: React.DragEvent, targetCategory: string) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('text/plain') || draggingItemId;
    if (!itemId) return;

    const item = await db.shopping.get(itemId);
    if (!item) return;

    const oldCategory = item.category;
    if (oldCategory === targetCategory) {
      setDraggingItemId(null);
      setDragOverCategory(null);
      return;
    }

    const now = Date.now();
    
    // Atualizar no IndexedDB
    await db.shopping.update(itemId, {
      category: targetCategory,
      updated_at: now
    });

    // Sincronizar cache local para futuras adições desse mesmo item lembrarem da preferência do usuário
    const normalizeText = (str: string): string => {
      return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
    };
    const nameNormalized = normalizeText(item.name);
    await db.metadata.put({
      key: 'shop_cache:' + nameNormalized,
      value: { category: targetCategory, correctedName: item.name }
    });

    // Se autenticado, registrar sync de atualização
    if (isAuthenticated) {
      await queueSyncOperation(itemId, 'shopping', 'update');
      triggerSync();
    }

    showToast(`"${item.name}" movido para "${targetCategory}".`, 'success');

    setDraggingItemId(null);
    setDragOverCategory(null);
  };

  // Riscar/Marcar Item de Compra
  const handleToggleShoppingItem = async (itemId: string) => {
    const item = await db.shopping.get(itemId);
    if (!item) return;

    const now = Date.now();
    const isChecked = item.checked === 1;
    const checkerName = currentUser ? currentUser.username : 'Membro';

    await db.shopping.update(itemId, {
      checked: isChecked ? 0 : 1,
      checked_by: isChecked ? undefined : checkerName,
      updated_at: now
    });

    if (!isChecked) {
      // transição de desmarcado para marcado (compra realizada)
      const parseQtyNumber = (qtyStr: string): number => {
        const match = qtyStr.match(/^(\d+(?:\.\d+)?)/);
        return match ? parseFloat(match[1]) : 1;
      };
      const qtyNum = parseQtyNumber(item.quantity || '');
      const recordId = generateUUID();
      const record: PurchaseRecord = {
        id: recordId,
        collection: 'purchase_history',
        shopping_item_id: item.id,
        name: item.name,
        quantity: item.quantity || '1 un',
        quantity_number: qtyNum,
        bought_at: now,
        bought_by: checkerName,
        updated_at: now,
        deleted: 0
      };
      await db.purchase_history.put(record);

      if (isAuthenticated) {
        await queueSyncOperation(recordId, 'purchase_history', 'insert');
      }

      sendFamilyNotification(
        t('notifShoppingItemChecked')
          .replace('{user}', currentUser?.display_name || checkerName)
          .replace('{name}', item.name)
          .replace('{quantity}', item.quantity || '1 un')
      );
    } else {
      // transição de marcado para desmarcado (cancelar compra)
      const linkedRecords = await db.purchase_history
        .where('shopping_item_id')
        .equals(item.id)
        .toArray();

      for (const rec of linkedRecords) {
        await db.purchase_history.update(rec.id, {
          deleted: 1,
          updated_at: now
        });
        if (isAuthenticated) {
          await queueSyncOperation(rec.id, 'purchase_history', 'update');
        }
      }
    }

    if (isAuthenticated) {
      await queueSyncOperation(itemId, 'shopping', 'update');
      triggerSync();
    }
  };

  // Excluir Item de Compra
  const handleDeleteShoppingItem = async (itemId: string) => {
    const now = Date.now();
    await db.shopping.update(itemId, { deleted: 1, updated_at: now });

    if (isAuthenticated) {
      await queueSyncOperation(itemId, 'shopping', 'update');
      triggerSync();
    }
  };

  // Arquivar Item de Compra (Imediatamente / Forçar Arquivamento)
  const handleArchiveShoppingItem = async (itemId: string) => {
    const now = Date.now();
    // Define o timestamp como 2 horas no passado para forçar o arquivamento sob a regra de 1h
    const forceArchiveTime = now - 2 * 60 * 60 * 1000;
    await db.shopping.update(itemId, {
      checked: 1,
      updated_at: forceArchiveTime
    });

    if (isAuthenticated) {
      await queueSyncOperation(itemId, 'shopping', 'update');
      triggerSync();
    }
  };

  // Ajustar Quantidade do Item de Compra
  const handleAdjustShoppingItemQty = async (itemId: string, amount: number) => {
    const item = await db.shopping.get(itemId);
    if (!item) return;

    const rawQty = (item.quantity || '').trim();
    const match = rawQty.match(/^(\d+)(.*)$/);
    let newQty: string;

    if (match) {
      const num = parseInt(match[1], 10);
      const suffix = match[2];
      const nextNum = Math.max(1, num + amount);
      newQty = `${nextNum}${suffix}`;
    } else {
      newQty = amount > 0 ? '2 un' : '1 un';
    }

    await db.shopping.update(itemId, {
      quantity: newQty,
      updated_at: Date.now()
    });

    if (isAuthenticated) {
      await queueSyncOperation(itemId, 'shopping', 'update');
      triggerSync();
    }
  };

  // Restaurar Item Arquivado
  const handleRestoreShoppingItem = async (itemId: string) => {
    await db.shopping.update(itemId, {
      checked: 0,
      checked_by: undefined,
      updated_at: Date.now()
    });

    if (isAuthenticated) {
      await queueSyncOperation(itemId, 'shopping', 'update');
      triggerSync();
    }
  };

  // --- FUNÇÕES AUXILIARES DE INTELIGÊNCIA ARTIFICIAL E COMPRAS ---

  // Parser de quantidade e nome para entrada rápida (Keep style)
  const parseQuantityAndName = (input: string) => {
    const prefixRegex = /^(\d+(?:\.\d+)?\s*(?:un|u|kg|g|litros?|l|pacotes?|pct|caixas?|cx|garrafas?|gfs)?(?:\s+de)?)\s+(.+)$/i;
    const suffixRegex = /^(.+?)\s+(\d+(?:\.\d+)?\s*(?:un|u|kg|g|litros?|l|pacotes?|pct|caixas?|cx|garrafas?|gfs)?)$/i;

    let quantity = '1 un';
    let name = input.trim();

    let match = name.match(prefixRegex);
    if (match) {
      quantity = match[1].trim();
      name = match[2].trim();
      if (quantity.toLowerCase().endsWith(' de')) {
        quantity = quantity.substring(0, quantity.length - 3).trim();
      }
    } else {
      match = name.match(suffixRegex);
      if (match) {
        name = match[1].trim();
        quantity = match[2].trim();
      }
    }

    if (name.length > 0) {
      name = name.charAt(0).toUpperCase() + name.slice(1);
    }

    return { name, quantity };
  };

  // Função auxiliar para buscar a unidade de medida usada mais recentemente no histórico local para um item de mesmo nome
  const getPastUnit = async (normalizedName: string): Promise<string | null> => {
    try {
      const items = await db.shopping.toArray();
      const normalizeText = (str: string): string => {
        return str
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim();
      };
      
      const matchingItems = items.filter(item => {
        const itemNorm = normalizeText(item.name);
        if (itemNorm !== normalizedName) return false;
        
        const qty = item.quantity.trim();
        // Verifica se a quantidade tem alguma letra (unidade de medida)
        // ex: "2 kg" ou "1.5 l" ou "10 un" tem letras, "4" não tem
        return /[a-zA-Z]/.test(qty);
      });

      if (matchingItems.length > 0) {
        // Ordenar por updated_at descendente para pegar o mais recente
        matchingItems.sort((a, b) => b.updated_at - a.updated_at);
        const latestQty = matchingItems[0].quantity.trim();
        
        // Extrair apenas a unidade (ex: de "2 kg" ou "1.5 litros" ou "10 un" pegar "kg", "litros" ou "un")
        const match = latestQty.match(/^\d+(?:\.\d+)?\s*(.+)$/);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
    } catch (err) {
      console.error('Erro ao buscar unidade histórica:', err);
    }
    return null;
  };

  // Classificação offline estática desativada. O sistema agora opera estritamente com Cache-First no IndexedDB e IA em tempo real.

  // Classificador remoto com correção ortográfica e unidade padrão via API oficial do Gemini (gemini-2.5-flash)
  const fetchRefinedItemFromGemini = async (
    itemName: string,
    apiKey: string
  ): Promise<{ category: string; correctedName: string; defaultUnit: string }> => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const prompt = `Você é um assistente de organização doméstica inteligente.
Classifique o item de lista de compras fornecido, corrija qualquer erro de digitação, ortografia, concordância ou acentuação no nome do item, e também determine a unidade de medida padrão/típica em português brasileiro (ex: "un", "kg", "g", "l", "ml", "pct", "cx", "gf").

Item original: "${itemName}"
Categorias válidas do sistema: "Alimentos", "Higiene", "Limpeza", "Farmácia", "Pet", "Bebê", "Casa & Utensílios", "Outros".

Siga estritamente as regras abaixo:
1. "categoria" deve ser exatamente um dos oito valores: "Alimentos", "Higiene", "Limpeza", "Farmácia", "Pet", "Bebê", "Casa & Utensílios" ou "Outros".
2. "nomeCorrigido" deve ser o nome do item corrigido ortograficamente em português, com acentuação correta e capitalização adequada (iniciando com maiúscula), por exemplo: "sabao em po" vira "Sabão em pó", "lampada de led" vira "Lâmpada de LED", "paracetaol" vira "Paracetamol", "leiti" vira "Leite", "chave de roda" vira "Chave de roda", "racao de gato" vira "Ração de gato".
3. "unidadePadrao" deve ser a abreviação em letras minúsculas da unidade de medida mais típica para esse produto (ex: "l" para Leite, "kg" para Carne/Arroz, "un" para Banana/Sabonete/Pão/Shampoo, "cx" para Ovos, "pct" para Café/Biscoito, "g" para Sal, "gf" para Óleo).
4. Para utilidades domésticas em geral, ferramentas, ferragens, pilhas, lâmpadas ou manutenção doméstica (como "chave de roda", "martelo", "pilha", "lâmpada", "fita isolante"), classifique estritamente na categoria "Casa & Utensílios".
5. Para itens destinados a animais de estimação (como "ração", "areia de gato", "brinquedo pet", "antipulgas", "sachê gato"), classifique na categoria "Pet".
6. Para itens destinados a bebês e crianças (como "fralda", "pomada de assadura", "fórmula infantil", "lenço umedecido", "mamadeira"), classifique na categoria "Bebê".
7. Para itens diversos que não se enquadram nas anteriores, use "Outros".
8. Responda APENAS com um objeto JSON válido seguindo a estrutura abaixo, sem markdown, sem blocos de código (como \`\`\`json), sem explicações:
{
  "categoria": "Nome da Categoria",
  "nomeCorrigido": "Nome do Item Corrigido",
  "unidadePadrao": "un"
}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Erro na API do Gemini: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (text) {
      try {
        const parsed = JSON.parse(text);
        let category = parsed.categoria || parsed.category || 'Alimentos';
        let correctedName = parsed.nomeCorrigido || parsed.correctedName || itemName;
        let defaultUnit = parsed.unidadePadrao || parsed.defaultUnit || 'un';

        // Limpar e validar a categoria obtida
        const validCategories = ['Alimentos', 'Higiene', 'Limpeza', 'Farmácia', 'Pet', 'Bebê', 'Casa & Utensílios', 'Outros'];
        const matched = validCategories.find(cat => cat.toLowerCase() === category.toLowerCase().trim());
        category = matched || 'Alimentos';

        // Sanitizar nome corrigido se necessário
        if (correctedName) {
          correctedName = correctedName.trim();
        } else {
          correctedName = itemName;
        }

        // Limpar e normalizar a unidade padrão
        if (defaultUnit) {
          defaultUnit = defaultUnit.toLowerCase().trim();
        } else {
          defaultUnit = 'un';
        }

        return { category, correctedName, defaultUnit };
      } catch (err) {
        console.error('Falha ao parsear resposta JSON do Gemini:', err);
        // Fallback secundário tentando regex se o JSON falhar de alguma forma
        const catMatch = text.match(/"categor?ia"\s*:\s*"([^"]+)"/i);
        const nameMatch = text.match(/"nomeCorrigido"\s*:\s*"([^"]+)"/i);
        const unitMatch = text.match(/"unidadePadrao"\s*:\s*"([^"]+)"/i);
        
        let category = 'Alimentos';
        if (catMatch && catMatch[1]) {
          const validCategories = ['Alimentos', 'Higiene', 'Limpeza', 'Farmácia', 'Pet', 'Bebê', 'Casa & Utensílios', 'Outros'];
          const matched = validCategories.find(cat => cat.toLowerCase() === catMatch[1].toLowerCase().trim());
          if (matched) category = matched;
        }
        
        let correctedName = itemName;
        if (nameMatch && nameMatch[1]) {
          correctedName = nameMatch[1].trim();
        }

        let defaultUnit = 'un';
        if (unitMatch && unitMatch[1]) {
          defaultUnit = unitMatch[1].toLowerCase().trim();
        }

        return { category, correctedName, defaultUnit };
      }
    }
    
    throw new Error('Não foi possível obter uma resposta válida do Gemini');
  };

  // Sugere e refina detalhes de uma tarefa com base no título via Gemini (gemini-2.5-flash)
  const fetchRefinedChoreFromGemini = async (
    title: string,
    apiKey: string
  ): Promise<{
    tituloCorrigido: string;
    description: string;
    points_worth: number;
    is_medication: boolean;
    repeats: boolean;
    recurrence_type: 'daily' | 'weekly' | 'monthly' | 'custom_days';
    time_type: 'all_day' | 'fixed' | 'period';
    fixed_time: string;
    period_time: 'manha' | 'tarde' | 'noite';
  }> => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const prompt = `Você é um assistente de organização doméstica inteligente.
Gere sugestões inteligentes para uma nova tarefa/atividade doméstica com base no título fornecido.
Seja criativo e útil para ajudar famílias a gerenciarem suas rotinas de casa.

Título da tarefa original: "${title}"

Determine e retorne os seguintes campos em português brasileiro:
1. "tituloCorrigido": O título da tarefa corrigido ortograficamente em português brasileiro, com acentuação e pontuação corretas e capitalização adequada (iniciando com maiúscula), por exemplo: "lavar o caroo" vira "Lavar o carro", "arrumar a camaa" vira "Arrumar a cama", "paracetaol" vira "Tomar Paracetamol", "tomar remedio" vira "Tomar remédio". Se o título já estiver correto, retorne o título original capitalizado.
2. "description": Uma descrição curta, clara e acionável com instruções de como realizar a tarefa (ex: para "lavar a louça": "Lavar todos os pratos, talheres e panelas acumulados na pia, secar e guardar nos armários.", para "paracetamol": "Tomar o medicamento de acordo com a dosagem recomendada pelo médico.").
3. "points_worth": Um valor numérico de pontos XP justo para a complexidade da tarefa (ex: tarefas simples como "tomar remédio" ou "arrumar a cama" valem 10 pontos; tarefas médias como "passar pano" ou "lavar louça" valem 30 pontos; tarefas pesadas ou demoradas como "lavar o carro" ou "limpar a casa toda" valem 50 a 80 pontos).
4. "is_medication": Um booleano (true/false) indicando se o título refere-se a um medicamento, vacina, remédio ou vitamina (ex: "paracetamol", "dipirona", "tomar remédio", "ibuprofeno", "vitamina D" são true).
5. "repeats": Um booleano indicando se é uma tarefa recorrente (ex: tarefas diárias/semanais como "fazer almoço" ou "dar comida para o gato" são true; tarefas pontuais/consertos como "consertar torneira" ou "comprar presente" são false).
6. "recurrence_type": A frequência sugerida, que deve ser exatamente um destes valores: "daily" (se diária), "weekly" (se semanal), "monthly" (se mensal), ou "custom_days" (caso use dias específicos).
7. "time_type": O tipo de horário recomendado, que deve ser exatamente: "all_day" (qualquer hora do dia), "fixed" (horário fixo específico) ou "period" (período específico).
8. "fixed_time": Caso o "time_type" seja "fixed", sugira um horário adequado no formato "HH:MM" (ex: "08:00", "13:00", "20:00"). Caso contrário, retorne "08:00".
9. "period_time": Caso o "time_type" seja "period", sugira um período adequado, que deve ser exatamente: "manha" (manhã), "tarde" ou "noite". Caso contrário, retorne "manha".

Responda APENAS com um objeto JSON válido seguindo a estrutura abaixo, sem explicações, sem markdown, sem blocos de código (como \`\`\`json):
{
  "tituloCorrigido": "Título Corrigido",
  "description": "Descrição sugerida...",
  "points_worth": 30,
  "is_medication": false,
  "repeats": true,
  "recurrence_type": "daily",
  "time_type": "all_day",
  "fixed_time": "08:00",
  "period_time": "manha"
}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Erro na API do Gemini: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (text) {
      try {
        const parsed = JSON.parse(text);
        const tituloCorrigido = parsed.tituloCorrigido || parsed.correctedTitle || title;
        const description = parsed.description || '';
        const points_worth = Number(parsed.points_worth) || 30;
        const is_medication = !!parsed.is_medication;
        const repeats = !!parsed.repeats;
        
        let recurrence_type: 'daily' | 'weekly' | 'monthly' | 'custom_days' = 'daily';
        if (parsed.recurrence_type === 'weekly' || parsed.recurrence_type === 'monthly' || parsed.recurrence_type === 'custom_days') {
          recurrence_type = parsed.recurrence_type;
        }

        let time_type: 'all_day' | 'fixed' | 'period' = 'all_day';
        if (parsed.time_type === 'fixed' || parsed.time_type === 'period') {
          time_type = parsed.time_type;
        }

        const fixed_time = parsed.fixed_time || '08:00';
        
        let period_time: 'manha' | 'tarde' | 'noite' = 'manha';
        if (parsed.period_time === 'tarde' || parsed.period_time === 'noite') {
          period_time = parsed.period_time;
        }

        return {
          tituloCorrigido,
          description,
          points_worth,
          is_medication,
          repeats,
          recurrence_type,
          time_type,
          fixed_time,
          period_time
        };
      } catch (err) {
        console.error('Falha ao parsear resposta JSON de tarefa do Gemini:', err);
        // Fallback robusto via regex
        const titMatch = text.match(/"tituloCorrigido"\s*:\s*"([^"]+)"/i) || text.match(/"correctedTitle"\s*:\s*"([^"]+)"/i);
        const descMatch = text.match(/"description"\s*:\s*"([^"]+)"/i);
        const ptsMatch = text.match(/"points_worth"\s*:\s*(\d+)/i);
        const medMatch = text.match(/"is_medication"\s*:\s*(true|false)/i);
        const repMatch = text.match(/"repeats"\s*:\s*(true|false)/i);
        const recMatch = text.match(/"recurrence_type"\s*:\s*"([^"]+)"/i);
        const ttMatch = text.match(/"time_type"\s*:\s*"([^"]+)"/i);
        const ftMatch = text.match(/"fixed_time"\s*:\s*"([^"]+)"/i);
        const ptMatch = text.match(/"period_time"\s*:\s*"([^"]+)"/i);

        const tituloCorrigido = titMatch && titMatch[1] ? titMatch[1] : title;
        const description = descMatch && descMatch[1] ? descMatch[1] : '';
        const points_worth = ptsMatch && ptsMatch[1] ? Number(ptsMatch[1]) : 30;
        const is_medication = medMatch && medMatch[1] ? medMatch[1].toLowerCase() === 'true' : false;
        const repeats = repMatch && repMatch[1] ? repMatch[1].toLowerCase() === 'true' : false;
        
        let recurrence_type: 'daily' | 'weekly' | 'monthly' | 'custom_days' = 'daily';
        if (recMatch && recMatch[1] && ['daily', 'weekly', 'monthly', 'custom_days'].includes(recMatch[1])) {
          recurrence_type = recMatch[1] as any;
        }

        let time_type: 'all_day' | 'fixed' | 'period' = 'all_day';
        if (ttMatch && ttMatch[1] && ['all_day', 'fixed', 'period'].includes(ttMatch[1])) {
          time_type = ttMatch[1] as any;
        }

        const fixed_time = ftMatch && ftMatch[1] ? ftMatch[1] : '08:00';
        
        let period_time: 'manha' | 'tarde' | 'noite' = 'manha';
        if (ptMatch && ptMatch[1] && ['manha', 'tarde', 'noite'].includes(ptMatch[1])) {
          period_time = ptMatch[1] as any;
        }

        return {
          tituloCorrigido,
          description,
          points_worth,
          is_medication,
          repeats,
          recurrence_type,
          time_type,
          fixed_time,
          period_time
        };
      }
    }

    throw new Error('Não foi possível obter uma resposta de tarefa válida do Gemini');
  };

  // Classificador em lote com correção ortográfica e categoria/unidade padrão via Gemini
  const fetchBatchRefinedItemsFromGemini = async (
    items: { id: string; name: string }[],
    apiKey: string
  ): Promise<Record<string, { category: string; correctedName: string; defaultUnit: string }>> => {
    if (items.length === 0) return {};

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const itemsJsonStr = JSON.stringify(items.map(item => ({ id: item.id, name: item.name })));

    const prompt = `Você é um assistente de organização doméstica inteligente.
Você receberá um array JSON contendo itens da lista de compras (cada um com "id" e "name").
Para cada item do array, você deve classificar o produto, corrigir qualquer erro de digitação, ortografia, concordância ou acentuação no nome do item ("name"), e também determinar a unidade de medida padrão/típica em português brasileiro (ex: "un", "kg", "g", "l", "ml", "pct", "cx", "gf").

Lista de itens:
${itemsJsonStr}

Categorias válidas do sistema: "Alimentos", "Higiene", "Limpeza", "Farmácia", "Pet", "Bebê", "Casa & Utensílios", "Outros".

Siga estritamente as regras abaixo:
1. "categoria" deve ser exatamente um dos oito valores: "Alimentos", "Higiene", "Limpeza", "Farmácia", "Pet", "Bebê", "Casa & Utensílios" ou "Outros".
2. "nomeCorrigido" deve ser o nome do item corrigido ortograficamente em português, com acentuação correta e capitalização adequada (iniciando com maiúscula), por exemplo: "sabao em po" vira "Sabão em pó", "leiti" vira "Leite".
3. "unidadePadrao" deve ser a abreviação em letras minúsculas da unidade de medida mais típica para esse produto (ex: "l" para Leite, "kg" para Carne/Arroz, "un" para Banana/Sabonete/Pão/Shampoo, "cx" para Ovos, "pct" para Café/Biscoito, "g" para Sal, "gf" para Óleo).
4. Para utilidades domésticas em geral, ferramentas, ferragens, pilhas, lâmpadas ou manutenção doméstica (como "chave de roda", "martelo", "pilha", "lâmpada", "fita isolante"), classifique estritamente na categoria "Casa & Utensílios".
5. Para itens destinados a animais de estimação, classifique na categoria "Pet".
6. Para itens destinados a bebês e crianças, classifique na categoria "Bebê".
7. Para itens diversos que não se enquadram nas anteriores, use "Outros".
8. Responda APENAS com um array JSON válido contendo objetos no formato abaixo, correspondendo exatamente ao id de cada item enviado, sem markdown, sem blocos de código (como \`\`\`json), sem explicações:
[
  {
    "id": "id_do_item",
    "categoria": "Nome da Categoria",
    "nomeCorrigido": "Nome do Item Corrigido",
    "unidadePadrao": "un"
  }
]`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Erro na API do Gemini: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    const result: Record<string, { category: string; correctedName: string; defaultUnit: string }> = {};

    if (text) {
      try {
        const parsedArray = JSON.parse(text);
        if (Array.isArray(parsedArray)) {
          const validCategories = ['Alimentos', 'Higiene', 'Limpeza', 'Farmácia', 'Pet', 'Bebê', 'Casa & Utensílios', 'Outros'];
          parsedArray.forEach((parsed: any) => {
            if (parsed && parsed.id) {
              let category = parsed.categoria || parsed.category || 'Alimentos';
              const matched = validCategories.find(cat => cat.toLowerCase() === category.toLowerCase().trim());
              category = matched || 'Alimentos';

              const originalItem = items.find(it => it.id === parsed.id);
              const originalName = originalItem ? originalItem.name : '';

              let correctedName = parsed.nomeCorrigido || parsed.correctedName || originalName;
              if (correctedName) {
                correctedName = correctedName.trim();
              } else {
                correctedName = originalName;
              }

              let defaultUnit = parsed.unidadePadrao || parsed.defaultUnit || 'un';
              defaultUnit = defaultUnit.toLowerCase().trim();

              result[parsed.id] = { category, correctedName, defaultUnit };
            }
          });
        }
      } catch (err) {
        console.error('Falha ao parsear resposta JSON em lote do Gemini:', err);
      }
    }
    return result;
  };

  // Processador em segundo plano de itens de compra pendentes
  const processPendingShoppingItems = async () => {
    if (!isOnline || !aiCategorizationEnabled || !geminiApiKey) {
      return;
    }

    const pendingItems = await db.shopping
      .filter(item => item.ai_status === 'pending' && item.deleted === 0)
      .toArray();

    if (pendingItems.length === 0) return;

    // Filtra itens que já estão ativamente sendo classificados
    const itemsToProcess = pendingItems.filter(item => !itemsBeingClassified.has(item.id));
    if (itemsToProcess.length === 0) return;

    // Adiciona na lista de classificação ativa
    setItemsBeingClassified(prev => {
      const next = new Set(prev);
      itemsToProcess.forEach(item => next.add(item.id));
      return next;
    });

    try {
      const results = await fetchBatchRefinedItemsFromGemini(
        itemsToProcess.map(it => ({ id: it.id, name: it.name })),
        geminiApiKey
      );

      const now = Date.now();

      for (const item of itemsToProcess) {
        const classification = results[item.id];
        if (classification) {
          const { category, correctedName, defaultUnit } = classification;

          const parseQtyNumber = (qtyStr: string): number => {
            const match = qtyStr.match(/^(\d+(?:\.\d+)?)/);
            return match ? parseFloat(match[1]) : 1;
          };
          const qtyNum = parseQtyNumber(item.quantity);
          const hasOnlyUn = item.quantity.toLowerCase().includes('un');
          let finalQuantity = item.quantity;
          if (hasOnlyUn && defaultUnit && defaultUnit !== 'un') {
            finalQuantity = `${qtyNum} ${defaultUnit}`;
          }

          await db.shopping.update(item.id, {
            name: correctedName,
            category,
            quantity: finalQuantity,
            ai_status: 'processed',
            updated_at: now
          });

          const normalizeText = (str: string): string => {
            return str
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase()
              .trim();
          };
          const nameNormalized = normalizeText(correctedName);
          const origNormalized = normalizeText(item.name);

          await db.metadata.put({
            key: 'shop_cache:' + nameNormalized,
            value: { category, correctedName, defaultUnit }
          });
          if (nameNormalized !== origNormalized) {
            await db.metadata.put({
              key: 'shop_cache:' + origNormalized,
              value: { category, correctedName, defaultUnit }
            });
          }

          if (isAuthenticated) {
            await queueSyncOperation(item.id, 'shopping', 'update');
          }
        }
      }

      if (isAuthenticated && Object.keys(results).length > 0) {
        triggerSync();
      }
    } catch (err) {
      console.error('Erro ao processar itens pendentes em lote:', err);
    } finally {
      setItemsBeingClassified(prev => {
        const next = new Set(prev);
        itemsToProcess.forEach(item => next.delete(item.id));
        return next;
      });
    }
  };

  // Motor Inteligente de Sugestões de Compra
  const generateSmartPurchaseSuggestions = async () => {
    setIsGeneratingSuggestions(true);
    try {
      const history = await db.purchase_history
        .filter(record => record.deleted === 0)
        .toArray();

      const activeItemNames = new Set(
        localShopping
          .filter(item => item.checked === 0 && item.deleted === 0)
          .map(item => item.name.toLowerCase().trim())
      );

      // Chamada remota ao Gemini se estiver online e configurado
      if (isOnline && aiCategorizationEnabled && geminiApiKey && history.length >= 3) {
        try {
          const suggestions = await fetchSmartSuggestionsFromGemini(history, Array.from(activeItemNames), geminiApiKey);
          if (suggestions && suggestions.length > 0) {
            setSmartSuggestions(suggestions);
            await db.metadata.put({ key: 'shop_recommendations', value: suggestions });
            setIsGeneratingSuggestions(false);
            return;
          }
        } catch (aiErr) {
          console.error('Falha ao gerar sugestões via Gemini, recorrendo a heurística local:', aiErr);
        }
      }

      // Fallback Heurístico local (se offline, sem chave, ou se tiver menos de 3 registros no histórico)
      const frequencyMap: Record<string, { count: number; lastBought: number; quantity: string; category: string }> = {};
      
      for (const rec of history) {
        const key = rec.name.toLowerCase().trim();
        if (activeItemNames.has(key)) continue;

        if (!frequencyMap[key]) {
          frequencyMap[key] = {
            count: 0,
            lastBought: 0,
            quantity: rec.quantity || '1 un',
            category: 'Alimentos'
          };
        }

        frequencyMap[key].count += rec.quantity_number || 1;
        if (rec.bought_at > frequencyMap[key].lastBought) {
          frequencyMap[key].lastBought = rec.bought_at;
          frequencyMap[key].quantity = rec.quantity || frequencyMap[key].quantity;
        }
      }

      const sortedKeys = Object.keys(frequencyMap).sort((a, b) => frequencyMap[b].count - frequencyMap[a].count);
      const suggestions: any[] = [];

      for (const key of sortedKeys.slice(0, 5)) {
        const itemInfo = frequencyMap[key];
        const historyMatch = history.find(rec => rec.name.toLowerCase().trim() === key);
        const displayName = historyMatch ? historyMatch.name : (key.charAt(0).toUpperCase() + key.slice(1));
        
        const cacheEntry = await db.metadata.get('shop_cache:' + key);
        const category = cacheEntry?.value?.category || itemInfo.category;

        const daysAgo = Math.floor((Date.now() - itemInfo.lastBought) / (1000 * 60 * 60 * 24));
        let reason = '';
        if (daysAgo === 0) {
          reason = language === 'en' ? 'Bought today' : 'Comprado hoje';
        } else if (daysAgo === 1) {
          reason = language === 'en' ? 'Bought yesterday' : 'Comprado ontem';
        } else {
          reason = language === 'en' ? `Bought ${daysAgo} days ago` : `Comprado há ${daysAgo} dias`;
        }

        suggestions.push({
          name: displayName,
          quantity: itemInfo.quantity,
          category: category,
          reason: reason
        });
      }

      setSmartSuggestions(suggestions);
      await db.metadata.put({ key: 'shop_recommendations', value: suggestions });
    } catch (err) {
      console.error('Erro ao gerar sugestões inteligentes de compras:', err);
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  // Chamada remota ao Gemini para predições de compras baseadas em histórico
  const fetchSmartSuggestionsFromGemini = async (
    history: PurchaseRecord[],
    activeItemNames: string[],
    apiKey: string
  ): Promise<any[]> => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const summaryMap: Record<string, { purchaseDates: string[]; quantities: string[] }> = {};
    history.forEach(rec => {
      const key = rec.name.trim();
      if (!summaryMap[key]) {
        summaryMap[key] = { purchaseDates: [], quantities: [] };
      }
      const dateStr = new Date(rec.bought_at).toISOString().split('T')[0];
      summaryMap[key].purchaseDates.push(dateStr);
      summaryMap[key].quantities.push(rec.quantity);
    });

    const prompt = `Você é um motor de IA inteligente para lista de compras residenciais.
Você analisará o histórico de compras de supermercado de uma família e preverá de 3 a 5 itens que eles provavelmente precisam comprar agora.
Use sua inteligência para identificar padrões (ex: se eles compram leite toda semana, e a última compra foi há 9 dias, eles provavelmente precisam de leite; se compram sabão em pó a cada 30 dias e a última foi há 28 dias, eles precisam de sabão).

Histórico de compras da família (agrupado por produto):
${JSON.stringify(summaryMap, null, 2)}

Itens que JÁ estão na lista de compras ativa da família (NÃO os sugira de forma alguma):
${JSON.stringify(activeItemNames)}

Categorias válidas do sistema: "Alimentos", "Higiene", "Limpeza", "Farmácia", "Pet", "Bebê", "Casa & Utensílios", "Outros".

Instruções para resposta:
1. Retorne de 3 a 5 sugestões.
2. Cada sugestão deve conter:
   - "name": Nome do produto (correto ortograficamente, ex: "Leite desnatado")
   - "quantity": Quantidade padrão recomendada com unidade (ex: "4 l", "1 kg")
   - "category": Categoria correspondente (exatamente um dos oito valores: "Alimentos", "Higiene", "Limpeza", "Farmácia", "Pet", "Bebê", "Casa & Utensílios" ou "Outros")
   - "reason": Uma frase amigável explicando por que você está sugerindo esse item (ex: "Comprado a cada 15 dias, última compra há 18 dias" ou "Consumo frequente registrado"). Use o idioma português brasileiro.
3. Responda APENAS com um array JSON válido, sem markdown, sem blocos de código (como \`\`\`json), sem explicações adicionais fora do JSON:
[
  {
    "name": "Nome do item",
    "quantity": "2 un",
    "category": "Alimentos",
    "reason": "Explicação amigável"
  }
]`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Erro na API do Gemini ao gerar sugestões: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (text) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (err) {
        console.error('Falha ao parsear sugestões do Gemini:', err);
      }
    }
    return [];
  };

  // Busca por histórico de tarefa similar concluída/adicionada no passado para herdar dados (fallback de IA)
  const getPastChoreDetails = async (normalizedTitle: string): Promise<Chore | null> => {
    try {
      const pastChores = await db.chores.toArray();
      const nonDeleted = pastChores.filter(c => {
        if (c.deleted) return false;
        if (!currentUser) return false;
        if (currentUser.role === 'admin') return true;
        const assigned = c.assigned_to;
        const coResp = c.co_responsible;
        const user = currentUser.username;
        return assigned === user || coResp === user || assigned === 'all';
      });

      // Encontra a tarefa mais recente com correspondência exata
      const exactMatch = nonDeleted
        .sort((a, b) => b.updated_at - a.updated_at)
        .find(c => {
          const pastNormalized = c.title
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
          return pastNormalized === normalizedTitle;
        });

      if (exactMatch) return exactMatch;

      // Se não houver correspondência exata, tenta encontrar por prefixo (auto-completar)
      const prefixMatch = nonDeleted
        .sort((a, b) => b.updated_at - a.updated_at)
        .find(c => {
          const pastNormalized = c.title
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
          return pastNormalized.startsWith(normalizedTitle);
        });

      return prefixMatch || null;
    } catch (err) {
      console.error('Erro ao buscar tarefa histórica:', err);
      return null;
    }
  };

  // Salvar configurações de IA localmente no IndexedDB
  const handleSaveGeminiConfig = async (apiKey: string, enabled: boolean) => {
    try {
      if (currentUser?.role !== 'admin') {
        showToast(t('toastAdminOnlyAi'), 'error');
        return;
      }

      setGeminiApiKey(apiKey);
      setAiCategorizationEnabled(enabled);
      
      await db.metadata.put({ key: 'gemini_api_key', value: apiKey });
      await db.metadata.put({ key: 'ai_categorization_enabled', value: enabled });

      // Salvar na tabela de sincronização de configurações de IA
      const aiConfigItem = {
        id: 'current_ai_config',
        collection: 'ai_config' as const,
        gemini_api_key: apiKey,
        ai_categorization_enabled: enabled,
        updated_at: Date.now()
      };
      await db.ai_config.put(aiConfigItem);

      if (isAuthenticated) {
        await queueSyncOperation('current_ai_config', 'ai_config', 'update');
        triggerSync();
      }
      
      showToast(t('toastAiSettingsSaved'), 'success');
    } catch (err) {
      console.error(err);
      showToast(t('toastAiSettingsSaveError'), 'error');
    }
  };

  // Limpar o cache local de classificação de IA (chaves shop_cache:* e chore_cache:*)
  const handleClearAiCache = async () => {
    try {
      const allMetadata = await db.metadata.toArray();
      const cacheKeys = allMetadata
        .filter(item => item.key.startsWith('shop_cache:') || item.key.startsWith('chore_cache:'))
        .map(item => item.key);

      if (cacheKeys.length === 0) {
        showToast(t('toastNoAiCache'), 'info');
        return;
      }

      await Promise.all(cacheKeys.map(key => db.metadata.delete(key)));
      showToast(t('toastAiCacheCleared').replace('{count}', String(cacheKeys.length)), 'success');
    } catch (err) {
      console.error('Erro ao limpar cache de IA:', err);
      showToast(t('toastAiCacheClearError'), 'error');
    }
  };



  // Criar Recompensa
  const [newRewardTitle, setNewRewardTitle] = useState<string>('');
  const [newRewardDesc, setNewRewardDesc] = useState<string>('');
  const [newRewardCost, setNewRewardCost] = useState<number>(100);

  const handleCreateReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRewardTitle || !newRewardCost) return;

    const id = generateUUID();
    const now = Date.now();
    const creator = currentUser ? currentUser.username : 'Pai';

    const newRew: Reward = {
      id,
      collection: 'rewards',
      title: newRewardTitle,
      description: newRewardDesc,
      cost_points: Number(newRewardCost),
      created_by: creator,
      updated_at: now,
      deleted: 0
    };

    await db.rewards.put(newRew);

    if (isAuthenticated) {
      await queueSyncOperation(id, 'rewards', 'insert');
      triggerSync();
    }

    setNewRewardTitle('');
    setNewRewardDesc('');
    setNewRewardCost(100);
  };

  // --- FUNÇÕES DE ADMINISTRAÇÃO DA FAMÍLIA ---
  const handleUpdateFamilyName = async (name: string) => {
    if (!name || !name.trim()) {
      showToast(t('toastFamilyNameEmpty'), 'error');
      return;
    }
    if (!isOnline || !token) {
      showToast(t('toastNeedOnlineToChangeSettings'), 'error');
      return;
    }
    try {
      const response = await fetch(`${backendUrl}/api/family/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name })
      });
      if (response.ok) {
        const updatedFamily = { ...family, name };
        setFamily(updatedFamily);
        await db.metadata.put({ key: 'family_info', value: updatedFamily });
        showToast(t('toastFamilyNameUpdateSuccess'), 'success');
      } else {
        const errData = await response.json();
        showToast(errData.error || t('toastFamilyNameUpdateError'), 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(t('toastServerConnectionError'), 'error');
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addMemUsername.trim() || !addMemPassword.trim()) {
      showToast(t('toastFillRequiredFields'), 'error');
      return;
    }
    if (!isOnline || !token) {
      showToast(t('toastNeedOnlineToManageMembers'), 'error');
      return;
    }

    try {
      const response = await fetch(`${backendUrl}/api/family/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: addMemUsername,
          password: addMemPassword,
          role: addMemRole,
          familyTitle: addMemTitle
        })
      });

      if (response.ok) {
        showToast(t('toastMemberAddSuccess'), 'success');
        setAddMemUsername('');
        setAddMemPassword('');
        setAddMemRole('user');
        setAddMemTitle('Filho');
        await fetchFamilyMembers();
      } else {
        const errData = await response.json();
        showToast(errData.error || t('toastMemberAddError'), 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(t('toastServerConnectionError'), 'error');
    }
  };

  const handleUpdateMember = async (memberId: string, role?: string, familyTitle?: string) => {
    if (!isOnline || !token) {
      showToast(t('toastNeedOnlineToManageMembers'), 'error');
      return;
    }
    try {
      const response = await fetch(`${backendUrl}/api/family/members/${memberId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role, familyTitle })
      });
      if (response.ok) {
        await fetchFamilyMembers();
      } else {
        const errData = await response.json();
        showToast(errData.error || t('toastMemberUpdateError'), 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(t('toastServerConnectionError'), 'error');
    }
  };

  const handleEvictMember = async (memberId: string) => {
    if (memberId === currentUser?.id) {
      showToast(t('toastCannotRemoveSelf'), 'error');
      return;
    }
    if (!confirm(t('confirmRemoveMember'))) {
      return;
    }
    if (!isOnline || !token) {
      showToast(t('toastNeedOnlineToManageMembers'), 'error');
      return;
    }
    try {
      const response = await fetch(`${backendUrl}/api/family/members/${memberId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        showToast(t('toastMemberRemoveSuccess'), 'success');
        await fetchFamilyMembers();
      } else {
        const errData = await response.json();
        showToast(errData.error || t('toastMemberRemoveError'), 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(t('toastServerConnectionError'), 'error');
    }
  };

  const handleResetPoints = async () => {
    if (!confirm(t('confirmResetScores'))) {
      return;
    }
    if (!isOnline || !token) {
      showToast(t('toastNeedOnlineToResetScores'), 'error');
      return;
    }
    try {
      const response = await fetch(`${backendUrl}/api/family/reset-points`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        showToast(t('toastScoresResetSuccess'), 'success');
        await triggerSync();
      } else {
        const errData = await response.json();
        showToast(errData.error || t('toastScoresResetError'), 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(t('toastServerConnectionError'), 'error');
    }
  };
  
  const handleResetMemberPassword = async (memberId: string, newPassword: string) => {
    if (!isOnline || !token) {
      showToast(t('toastNeedOnlineToResetPassword'), 'error');
      return false;
    }
    if (!newPassword || !newPassword.trim()) {
      showToast(t('toastPasswordEmpty'), 'error');
      return false;
    }
    try {
      const response = await fetch(`${backendUrl}/api/family/members/${memberId}/reset-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: newPassword })
      });
      if (response.ok) {
        showToast(t('toastMemberPasswordResetSuccess'), 'success');
        return true;
      } else {
        const errData = await response.json();
        showToast(errData.error || t('toastMemberPasswordResetError'), 'error');
        return false;
      }
    } catch (err) {
      console.error(err);
      showToast(t('toastServerConnectionError'), 'error');
      return false;
    }
  };

  const handleExportBackup = async () => {
    if (!isOnline || !token) {
      showToast(t('toastNeedOnlineToExportBackup'), 'error');
      return;
    }
    try {
      showToast(t('toastExportingBackup'), 'info');
      const response = await fetch(`${backendUrl}/api/family/backup/export`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const familyNameClean = family ? family.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'familia';
        a.download = `familysync_backup_${familyNameClean}_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showToast(t('toastExportBackupSuccess'), 'success');
      } else {
        const errData = await response.json();
        showToast(errData.error || t('toastExportBackupError'), 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(t('toastServerConnectionError'), 'error');
    }
  };

  const handleImportBackup = async (file: File) => {
    if (!isOnline || !token) {
      showToast(t('toastNeedOnlineToImportBackup'), 'error');
      return;
    }
    if (!file) return;
    
    try {
      const text = await file.text();
      let backupData;
      try {
        backupData = JSON.parse(text);
      } catch {
        showToast(t('toastInvalidJson'), 'error');
        return;
      }

      if (!backupData.family || !Array.isArray(backupData.members) || !Array.isArray(backupData.sync_items)) {
        showToast(t('toastInvalidBackupFormat'), 'error');
        return;
      }

      if (backupData.family.id !== family?.id) {
        showToast(t('toastBackupOtherFamily'), 'error');
        return;
      }

      if (!confirm(t('confirmRestoreBackup'))) {
        return;
      }

      showToast(t('toastRestoringBackup'), 'info');
      const response = await fetch(`${backendUrl}/api/family/backup/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: text
      });

      if (response.ok) {
        showToast(t('toastRestoreBackupSuccess'), 'success');
        await triggerSync();
        await fetchFamilyMembers();
      } else {
        const errData = await response.json();
        showToast(errData.error || t('toastRestoreBackupError'), 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(t('toastRestoreBackupError'), 'error');
    }
  };

  const loadLocalBackupsIndex = async () => {
    try {
      const obj = await db.metadata.get('local_backups_index');
      if (obj && Array.isArray(obj.value)) {
        setLocalBackupsIndex(obj.value);
      } else {
        setLocalBackupsIndex([]);
      }
    } catch (e) {
      console.error('Erro ao ler índice de backups locais:', e);
    }
  };

  const createLocalBackupSnapshot = async (label = 'Backup Automático') => {
    if (!isOnline || !token || currentUser?.role !== 'admin') {
      return null;
    }
    try {
      const response = await fetch(`${backendUrl}/api/family/backup/export`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const backupData = await response.json();
        const timestamp = Date.now();
        const backupId = `local_backup_${timestamp}`;
        
        // 1. Salvar o backup no metadata
        await db.metadata.put({ key: backupId, value: backupData });
        
        // 2. Atualizar o índice
        const indexObj = await db.metadata.get('local_backups_index');
        let indexList = indexObj ? indexObj.value : [];
        if (!Array.isArray(indexList)) indexList = [];
        
        indexList.unshift({
          id: backupId,
          timestamp,
          label
        });
        
        while (indexList.length > 3) {
          const oldBackup = indexList.pop();
          if (oldBackup) {
            await db.metadata.delete(oldBackup.id).catch(() => {});
          }
        }
        
        await db.metadata.put({ key: 'local_backups_index', value: indexList });
        setLocalBackupsIndex(indexList);
        return indexList;
      }
    } catch (e) {
      console.error('Erro ao gerar backup rotativo local:', e);
    }
    return null;
  };

  const handleRestoreLocalBackup = async (backupId: string) => {
    if (!isOnline || !token) {
      showToast(t('toastNeedOnlineToRestoreBackup'), 'error');
      return;
    }
    if (!confirm(t('confirmRestoreBackup'))) {
      return;
    }
    try {
      const backupObj = await db.metadata.get(backupId);
      if (!backupObj || !backupObj.value) {
        showToast(t('toastLocalBackupNotFound'), 'error');
        return;
      }
      
      const backupData = backupObj.value;
      const text = JSON.stringify(backupData);
      
      showToast(t('toastRestoringLocalBackup'), 'info');
      const response = await fetch(`${backendUrl}/api/family/backup/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: text
      });

      if (response.ok) {
        showToast(t('toastLocalRestoreBackupSuccess'), 'success');
        await triggerSync();
        await fetchFamilyMembers();
      } else {
        const errData = await response.json();
        showToast(errData.error || t('toastRestoreBackupError'), 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(t('toastRestoreBackupError'), 'error');
    }
  };

  const handleCreateManualLocalBackup = async () => {
    showToast(t('toastCreatingLocalBackup'), 'info');
    const indexList = await createLocalBackupSnapshot('Backup Manual Instantâneo');
    if (indexList) {
      showToast(t('toastLocalBackupSuccess'), 'success');
    } else {
      showToast(t('toastLocalBackupError'), 'error');
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      Promise.resolve().then(() => {
        loadLocalBackupsIndex();
      });
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const triggerDailyBackup = async () => {
      if (isAuthenticated && isOnline && token && currentUser?.role === 'admin') {
        try {
          const lastBackupTimeObj = await db.metadata.get('last_auto_backup_time');
          const lastBackupTime = lastBackupTimeObj ? Number(lastBackupTimeObj.value) : 0;
          const now = Date.now();
          if (now - lastBackupTime > 86400000) {
            console.log('Executando backup rotativo diário automático...');
            const indexList = await createLocalBackupSnapshot('Auto Backup Diário');
            if (indexList) {
              await db.metadata.put({ key: 'last_auto_backup_time', value: now });
            }
          }
        } catch (err) {
          console.error('Erro no auto-backup diário:', err);
        }
      }
    };
    triggerDailyBackup();
  }, [isAuthenticated, isOnline, token, currentUser]);


  // Resgatar Recompensa
  const handleRedeemReward = async (rewardId: string) => {
    const reward = await db.rewards.get(rewardId);
    if (!reward) return;

    const userName = currentUser ? currentUser.username : 'Filho';
    const userId = currentUser ? currentUser.id : 'demo-user-child';
    const now = Date.now();

    // Calcular pontos totais do usuário atual
    const userTotalPoints = localPoints
      .filter(p => p.user_id === userId)
      .reduce((acc, p) => acc + p.points, 0);

    if (userTotalPoints < reward.cost_points) {
      showToast(t('toastInsufficientPoints').replace('{points}', String(reward.cost_points - userTotalPoints)), 'error');
      return;
    }

    // Deduzir pontos subtraindo da tabela de logs de ponto
    const ptId = generateUUID();
    const pointDeduction: PointLog = {
      id: ptId,
      collection: 'points',
      user_id: userId,
      user_name: userName,
      points: -reward.cost_points, // Pontos negativos deduzem do saldo
      reason: `Resgatou: ${reward.title}`,
      timestamp: now,
      updated_at: now
    };
    await db.points.put(pointDeduction);

    if (isAuthenticated) {
      await queueSyncOperation(ptId, 'points', 'insert');
      triggerSync();
    }

    sendFamilyNotification(
      t('notifRewardRedeemed')
        .replace('{user}', currentUser?.display_name || userName)
        .replace('{title}', reward.title)
        .replace('{points}', reward.cost_points.toString())
    );

    showToast(t('toastRewardRedeemedSuccess').replace('{title}', reward.title), 'success');
  };


  // --- SIMULADORES PREMIUM INTERATIVOS ---


  // --- ANÁLISE E CÁLCULO DE GRÁFICOS / GAMIFICAÇÃO ---

  // Cálculo de XP / Nível da Família ou Usuário Ativo
  const userStats = useMemo(() => {
    const stats: { [key: string]: { points: number; level: number; nextLevelXp: number; displayName: string } } = {};

    // Inicializar dinamicamente com os membros reais da família
    const activeMembers = familyMembers;
    activeMembers.forEach(m => {
      stats[m.username] = { 
        points: 0, 
        level: 1, 
        nextLevelXp: 100, 
        displayName: m.display_name || m.username 
      };
    });

    // Atualizar com os logs locais de ponto
    localPoints.forEach(log => {
      const user = log.user_name;
      if (!stats[user]) {
        stats[user] = { 
          points: 0, 
          level: 1, 
          nextLevelXp: 100, 
          displayName: log.user_name 
        };
      }
      stats[user].points += log.points;
      
      // Ajuste básico de nível por pontos
      const calculatedLevel = Math.floor(stats[user].points / 150) + 1;
      stats[user].level = Math.max(1, calculatedLevel);
      stats[user].nextLevelXp = stats[user].level * 150;
    });

    return stats;
  }, [localPoints, familyMembers]);

  // --- CÁLCULO DE RELATÓRIOS E ESTATÍSTICAS (v1.2.0) ---

  const filteredPointLogs = useMemo(() => {
    return localPoints.filter(log => {
      const matchUser = reportsSelectedUser === 'all' || log.user_name === reportsSelectedUser || log.user_id === reportsSelectedUser;
      const isTask = log.points > 0 && log.reason.includes('Concluiu:');
      const isMed = log.points > 0 && log.reason.includes('Tomou:');
      const isReward = log.points < 0 && log.reason.includes('Resgatou:');
      
      let matchType = true;
      if (reportsSelectedType === 'tasks') matchType = isTask;
      else if (reportsSelectedType === 'meds') matchType = isMed;
      else if (reportsSelectedType === 'rewards') matchType = isReward;
      
      const matchSearch = !reportsSearch.trim() || log.reason.toLowerCase().includes(reportsSearch.toLowerCase()) || log.user_name.toLowerCase().includes(reportsSearch.toLowerCase());
      
      return matchUser && matchType && matchSearch;
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [localPoints, reportsSelectedUser, reportsSelectedType, reportsSearch]);

  const reportsStats = useMemo(() => {
    let tasksCount = 0;
    let medsCount = 0;
    let rewardsCount = 0;
    let familyXp = 0;
    
    localPoints.forEach(log => {
      if (log.points > 0) {
        familyXp += log.points;
        if (log.reason.includes('Concluiu:')) {
          tasksCount++;
        } else if (log.reason.includes('Tomou:')) {
          medsCount++;
        }
      } else if (log.points < 0 && log.reason.includes('Resgatou:')) {
        rewardsCount++;
      }
    });
    
    return { tasksCount, medsCount, rewardsCount, familyXp };
  }, [localPoints]);

  const reportsHighlights = useMemo(() => {
    const earned: Record<string, number> = {};
    const spent: Record<string, number> = {};
    
    localPoints.forEach(log => {
      const name = log.user_name;
      if (log.points > 0) {
        earned[name] = (earned[name] || 0) + log.points;
      } else if (log.points < 0 && log.reason.includes('Resgatou:')) {
        spent[name] = (spent[name] || 0) + Math.abs(log.points);
      }
    });
    
    let topEarner = 'none';
    let maxEarned = 0;
    Object.entries(earned).forEach(([name, val]) => {
      if (val > maxEarned) {
        maxEarned = val;
        topEarner = name;
      }
    });
    
    let topSpender = 'none';
    let maxSpent = 0;
    Object.entries(spent).forEach(([name, val]) => {
      if (val > maxSpent) {
        maxSpent = val;
        topSpender = name;
      }
    });
    
    return { topEarner, maxEarned, topSpender, maxSpent };
  }, [localPoints]);

  const contributionSegments = useMemo(() => {
    const earned: Record<string, number> = {};
    let total = 0;
    
    localPoints.forEach(log => {
      if (log.points > 0) {
        const name = log.user_name;
        earned[name] = (earned[name] || 0) + log.points;
        total += log.points;
      }
    });
    
    const circumference = 314.16;
    const colors = ['#7c3aed', '#10b981', '#06b6d4', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];
    let accumulatedPercent = 0;
    
    return Object.entries(earned).map(([name, pts], idx) => {
      const percent = total > 0 ? (pts / total) * 100 : 0;
      const strokeDasharray = `${(percent * circumference) / 100} ${circumference}`;
      const strokeDashoffset = circumference - ((accumulatedPercent * circumference) / 100);
      accumulatedPercent += percent;
      
      return {
        name,
        points: pts,
        percent: percent.toFixed(1),
        color: colors[idx % colors.length],
        strokeDasharray,
        strokeDashoffset
      };
    });
  }, [localPoints]);

  const weeklyTrendData = useMemo(() => {
    const days = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toLocaleDateString(language === 'pt' ? 'pt-BR' : language, { weekday: 'short', day: 'numeric' });
      
      const y = d.getFullYear();
      const startOfDay = new Date(y, d.getMonth(), d.getDate()).getTime();
      const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;
      
      const count = localPoints.filter(log => 
        log.points > 0 && 
        log.timestamp >= startOfDay && 
        log.timestamp <= endOfDay
      ).length;
      
      days.push({ label: dateStr, count });
    }
    
    const maxCount = Math.max(...days.map(d => d.count), 1);
    return days.map(d => ({
      ...d,
      percent: (d.count / maxCount) * 100
    }));
  }, [localPoints, language]);

  // Taxa de cumprimento das tarefas de hoje
  const choreProgressToday = useMemo(() => {
    const todayStr = getTodayStr();
    const tasksForToday = visibleChores
      .filter(c => isChoreActiveOnDate(c, todayStr))
      .sort(sortChoresChronologically);

    if (tasksForToday.length === 0) return { total: 0, completed: 0, percentage: 100 };

    const completed = tasksForToday.filter(c => isChoreCompletedOnDate(c, todayStr)).length;
    return {
      total: tasksForToday.length,
      completed,
      percentage: Math.round((completed / tasksForToday.length) * 100)
    };
  }, [visibleChores, currentDayName]);

  // Taxa de cumprimento das tarefas para o dia selecionado no calendário
  const selectedDateProgress = useMemo(() => {
    const year = calendarSelectedDate.getFullYear();
    const month = String(calendarSelectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(calendarSelectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const tasksForDate = visibleChores
      .filter(c => isChoreActiveOnDate(c, dateStr))
      .sort(sortChoresChronologically);

    if (tasksForDate.length === 0) return { total: 0, completed: 0, percentage: 100 };

    const completed = tasksForDate.filter(c => isChoreCompletedOnDate(c, dateStr)).length;
    return {
      total: tasksForDate.length,
      completed,
      percentage: Math.round((completed / tasksForDate.length) * 100)
    };
  }, [visibleChores, calendarSelectedDate]);

  // --- MEMOS PARA LISTA DE COMPRAS E HISTÓRICO/SUGESTÕES ---
  const activeShoppingItems = useMemo(() => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    return localShopping.filter(item => 
      item.checked === 0 || (item.checked === 1 && item.updated_at >= oneHourAgo)
    );
  }, [localShopping, currentTime]);

  const archivedShoppingItems = useMemo(() => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    return localShopping.filter(item => 
      item.checked === 1 && item.updated_at < oneHourAgo
    );
  }, [localShopping, currentTime]);

  const shoppingSuggestions = useMemo(() => {
    const inputVal = keepItemName;
    if (!inputVal || inputVal.trim().length < 1) return [];
    const queryText = inputVal.toLowerCase().trim();
    
    // Filtrar itens locais que contêm o texto digitado (busca case-insensitive por substring)
    const filtered = localShopping.filter(item => 
      item.name.toLowerCase().includes(queryText)
    );

    // Remover duplicatas de nome para manter sugestões únicas e mais recentes
    const uniqueNames: { [key: string]: typeof localShopping[0] } = {};
    for (const item of filtered) {
      const norm = item.name.toLowerCase().trim();
      if (!uniqueNames[norm] || item.updated_at > uniqueNames[norm].updated_at) {
        uniqueNames[norm] = item;
      }
    }

    // Ordenar priorizando itens que começam com o termo pesquisado, seguidos pelos mais recentes
    return Object.values(uniqueNames)
      .sort((a, b) => {
        const aName = a.name.toLowerCase().trim();
        const bName = b.name.toLowerCase().trim();
        const aStarts = aName.startsWith(queryText);
        const bStarts = bName.startsWith(queryText);

        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        // Se ambos começam ou ambos não começam com o termo, ordena pelo mais recente (updated_at)
        return b.updated_at - a.updated_at;
      })
      .slice(0, 5); // limite de 5 sugestões
  }, [keepItemName, localShopping]);


  // --- RENDERIZAÇÃO ---



  // TELA DE LOGIN / REGISTRO SE NÃO ESTIVER AUTENTICADO
  if (!isAuthenticated) {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'var(--bg-main)' }}>
        <div className="glass-panel animate-scale-up" style={{ width: '100%', maxWidth: '440px', padding: '36px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
            <select
              value={language}
              onChange={async (e) => {
                const newLang = e.target.value;
                setLanguage(newLang);
                await db.metadata.put({ key: 'language', value: newLang });
              }}
              className="input-field"
              style={{
                width: 'auto',
                padding: '4px 12px',
                height: '32px',
                fontSize: '12px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                color: 'var(--text-primary)'
              }}
            >
              <option value="pt">🇧🇷 Português</option>
              <option value="en">🇺🇸 English</option>
              <option value="es">🇪🇸 Español</option>
              <option value="pl">🇵🇱 Polski</option>
              <option value="de">🇩🇪 Deutsch</option>
              <option value="fr">🇫🇷 Français</option>
              <option value="it">🇮🇹 Italiano</option>
            </select>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '18px' }}>
              <img src="/logo.png?v=2" alt="FamilySync Logo" style={{ width: '96px', height: '96px', borderRadius: '24px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)' }} />
            </div>
            <h1 style={{ fontSize: '32px', fontWeight: '800', marginTop: '16px', letterSpacing: '-1px', color: 'var(--text-primary)', fontFamily: '"Outfit", "Inter", sans-serif' }}>FamilySync</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px' }}>
              {t('loginSubtitle')}
            </p>
          </div>

          {authError && (
            <div className="glass-panel" style={{ border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)', color: 'var(--accent-danger)', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '20px', fontSize: '14px' }}>
              ⚠️ {authError}
            </div>
          )}

            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>{t('loginUsername')}</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder={t('loginUsernamePlaceholder')}
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  required
                />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>{t('loginPassword')}</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder={t('loginPasswordPlaceholder')}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '14px' }}>
                {t('loginButton')}
              </button>

              <div className="glass-panel" style={{ marginTop: '24px', border: '1px solid rgba(59, 130, 246, 0.25)', background: 'rgba(59, 130, 246, 0.03)', padding: '14px', borderRadius: 'var(--radius-md)', textAlign: 'left' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
                  {t('loginSelfHostedTitle')}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.5' }}>
                  {t('loginSelfHostedDesc')}
                </p>
                {!onboardingCompleted && (
                  <p style={{ fontSize: '11px', color: 'var(--accent-primary-hover)', margin: '8px 0 0 0', fontWeight: '600' }}>
                    {t('loginFirstAccessAdmin')}
                  </p>
                )}
              </div>
            </form>


        </div>
      </div>
    );
  }

  // SE ESTIVER AUTENTICADO MAS O USUÁRIO FOR O 'admin' PADRÃO, FORÇAR RECONFIGURAÇÃO DE SEGURANÇA IMEDIATAMENTE (REMOÇÃO DO 'admin/admin' PADRÃO)
  if (isAuthenticated && currentUser?.username === 'admin') {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'var(--bg-main)' }}>
        <div className="glass-panel animate-scale-up" style={{ width: '100%', maxWidth: '480px', padding: '36px', border: '1px solid rgba(139, 92, 246, 0.35)', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)' }}>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
            <select
              value={language}
              onChange={async (e) => {
                const newLang = e.target.value;
                setLanguage(newLang);
                await db.metadata.put({ key: 'language', value: newLang });
              }}
              className="input-field"
              style={{
                width: 'auto',
                padding: '4px 12px',
                height: '32px',
                fontSize: '12px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                color: 'var(--text-primary)'
              }}
            >
              <option value="pt">🇧🇷 Português</option>
              <option value="en">🇺🇸 English</option>
              <option value="es">🇪🇸 Español</option>
              <option value="pl">🇵🇱 Polski</option>
              <option value="de">🇩🇪 Deutsch</option>
              <option value="fr">🇫🇷 Français</option>
              <option value="it">🇮🇹 Italiano</option>
            </select>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <img src="/logo.png?v=2" alt="FamilySync Logo" style={{ width: '80px', height: '80px', borderRadius: '20px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)' }} />
            </div>
            <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--accent-warning)', textTransform: 'uppercase', letterSpacing: '2px', background: 'rgba(245, 158, 11, 0.1)', padding: '4px 12px', borderRadius: '999px' }}>
              {t('securityTitle')}
            </span>
            <h1 style={{ fontSize: '26px', fontWeight: '700', marginTop: '12px', letterSpacing: '-1px' }}>{t('setupAdmin')}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '8px', lineHeight: '1.5' }}>
              {t('setupDesc')}
            </p>
          </div>

          {setupError && (
            <div className="glass-panel" style={{ border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)', color: 'var(--accent-danger)', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '20px', fontSize: '13px' }}>
              ⚠️ {setupError}
            </div>
          )}

          <form onSubmit={handleForcedSetupSubmit}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>{t('fullName')}</label>
              <input
                type="text"
                className="input-field"
                placeholder={t('fullNamePlaceholder')}
                value={setupDisplayName}
                onChange={(e) => setSetupDisplayName(e.target.value)}
                required
              />
            </div>
            
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>{t('username')}</label>
              <input
                type="text"
                className="input-field"
                placeholder={t('usernamePlaceholder')}
                value={setupUsername}
                onChange={(e) => setSetupUsername(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>{t('familyTitle')}</label>
              <select
                className="input-field"
                value={setupFamilyTitle}
                onChange={(e) => setSetupFamilyTitle(e.target.value)}
                style={{ height: '46px' }}
                required
              >
                <option value="Pai">{t('titleFather')}</option>
                <option value="Mãe">{t('titleMother')}</option>
                <option value="Filho">{t('titleSon')}</option>
                <option value="Filha">{t('titleDaughter')}</option>
                <option value="Avô">{t('titleGrandfather')}</option>
                <option value="Avó">{t('titleGrandmother')}</option>
                <option value="Tio">{t('titleUncle')}</option>
                <option value="Tia">{t('titleAunt')}</option>
                <option value="Outro">{t('titleOther')}</option>
              </select>
            </div>

            <div style={{ marginBottom: '22px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>{t('password')}</label>
              <input
                type="password"
                className="input-field"
                placeholder={t('passwordPlaceholder')}
                value={setupPassword}
                onChange={(e) => setSetupPassword(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={handleLogout}
                className="btn-secondary"
                style={{ flex: 1, padding: '12px' }}
              >
                {t('logout')}
              </button>
              <button
                type="submit"
                className="btn-primary"
                style={{ flex: 2, padding: '12px', background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-primary-hover) 100%)' }}
                disabled={setupLoading}
              >
                {setupLoading ? t('saving') : t('saveAndActivate')}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // TELA PRINCIPAL (MAIN SPA)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-main)' }}>
      
      {/* HEADER DE SINCRONIZAÇÃO E CONTROLES DE SIMULAÇÃO */}
      {isFridgeMode ? (
        <header className="fridge-header glass-panel animate-fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', margin: '16px 16px 0 16px', borderRadius: 'var(--radius-lg)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', backdropFilter: 'blur(12px)', flexWrap: 'wrap', gap: '16px' }}>
          {/* Left: Clock, Greeting & Sync Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-1px', color: 'var(--text-primary)', lineHeight: '1', fontFamily: '"Outfit", "Inter", sans-serif' }}>
                {currentTime.toLocaleTimeString(LOCALE_MAP[language] || 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: '500' }}>
                {getLocalizedDate(currentTime, language)}
              </div>
            </div>
            
            <div className="hide-on-mobile" style={{ height: '32px', width: '1px', background: 'var(--border-light)' }}></div>
            
            <div>
              <h1 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                {(() => {
                  const hr = currentTime.getHours();
                  if (hr >= 6 && hr < 12) return '🌅 ' + t('greetingMorning');
                  if (hr >= 12 && hr < 18) return '☀️ ' + t('greetingAfternoon');
                  return '🌙 ' + t('greetingEvening');
                })()}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: isOnline ? 'var(--accent-success)' : 'var(--accent-danger)', boxShadow: isOnline ? '0 0 8px var(--accent-success)' : '0 0 8px var(--accent-danger)' }}></span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {isOnline ? t('syncStatusOnline') : t('syncStatusOffline')}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Smart Controls & Exit Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Connection simulation toggle */}
            <button
              onClick={() => {
                setIsOnline(!isOnline);
                if (!isOnline) setTimeout(triggerSync, 500);
              }}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              title={t('toggleConnection')}
            >
              {isOnline ? <Wifi size={13} style={{ color: 'var(--accent-success)' }} /> : <WifiOff size={13} style={{ color: 'var(--accent-danger)' }} />}
              <span>{isOnline ? t('syncStatusOnline') : t('syncStatusOffline')}</span>
            </button>

            {/* Alternador de Tema no Modo Geladeira */}
            <button
              onClick={toggleTheme}
              className="btn-secondary"
              style={{
                padding: '6px',
                borderRadius: '50%',
                minWidth: '32px',
                height: '32px',
                border: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255, 255, 255, 0.04)',
                cursor: 'pointer',
                transition: 'transform var(--transition-fast)'
              }}
              title={theme === 'dark' ? t('switchToLightMode') : t('switchToDarkMode')}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {theme === 'dark' ? (
                <Sun size={13} style={{ color: '#f59e0b' }} />
              ) : (
                <Moon size={13} style={{ color: '#7c3aed' }} />
              )}
            </button>

            {/* Exit Panel button */}
            <button
              onClick={() => setIsFridgeMode(false)}
              className="btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: '600',
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary-hover))',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.25)',
                cursor: 'pointer'
              }}
            >
              <Tablet size={14} />
              <span>{t('exitFridgeMode')}</span>
            </button>
          </div>
        </header>
      ) : (
        <header className="main-header glass-panel">
          
          {/* Identificação de Família */}
          <div className="header-identity" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/logo.png?v=2" alt="FamilySync Logo" style={{ height: '36px', width: '36px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }} />
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: '700', letterSpacing: '-0.3px' }}>
                {family ? family.name : 'Grupo Local Demo'}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                <span className="hide-on-xs">{t('helloUser')} <strong>{currentUser ? (currentUser.display_name || currentUser.username) : t('member')}</strong></span>
              </div>
            </div>
          </div>

          {/* Barra de Progresso do Dia Selecionado */}
          <div className="header-progress-container">
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700', whiteSpace: 'nowrap' }}>
              {t('progressLabel')}: <span style={{ color: selectedDateProgress.percentage === 100 ? 'var(--accent-success)' : selectedDateProgress.percentage > 30 ? 'var(--accent-info)' : 'var(--accent-primary-hover)' }}>{selectedDateProgress.percentage}%</span>
            </span>
            <div style={{ width: '80px', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden', position: 'relative' }}>
              <div style={{ width: `${selectedDateProgress.percentage}%`, height: '100%', background: selectedDateProgress.percentage === 100 ? 'var(--accent-success)' : selectedDateProgress.percentage > 30 ? 'var(--accent-info)' : 'var(--accent-primary)', borderRadius: '3px', transition: 'width 0.4s ease' }} />
            </div>
            {selectedDateProgress.total > 0 && (
              <span className="hide-on-mobile" style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                ({selectedDateProgress.completed}/{selectedDateProgress.total})
              </span>
            )}
          </div>

          {/* Simuladores de Geolocalização e NFC e Internet */}
          <div className="header-actions">
            
            {/* Conexão Simulada */}
            <button
              onClick={() => {
                setIsOnline(!isOnline);
                if (!isOnline) setTimeout(triggerSync, 500);
              }}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', background: isOnline ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)', borderColor: isOnline ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)' }}
              title={t('toggleConnectionDesc')}
            >
              {isOnline ? (
                <>
                  <Wifi size={14} style={{ color: 'var(--accent-success)' }} />
                  <span className="hide-on-mobile" style={{ color: 'var(--accent-success)', fontWeight: '600' }}>{t('syncStatusOnline')}</span>
                </>
              ) : (
                <>
                  <WifiOff size={14} style={{ color: 'var(--accent-danger)' }} />
                  <span className="hide-on-mobile" style={{ color: 'var(--accent-danger)', fontWeight: '600' }}>{t('syncStatusOffline')}</span>
                </>
              )}
            </button>

            {/* Sincronização Manual */}
            {isOnline && (
              <button
                onClick={triggerSync}
                disabled={isSyncing}
                className="btn-secondary"
                style={{ padding: '6px', borderRadius: '50%', minWidth: '32px', height: '32px' }}
                title={t('forceSync')}
              >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} style={{ animation: isSyncing ? 'pulseGlow 1.5s infinite' : 'none' }} />
              </button>
            )}

            {/* Modo Geladeira (Tablet) */}
            <button
              onClick={() => setIsFridgeMode(!isFridgeMode)}
              className="btn-secondary hide-on-mobile"
              style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', background: isFridgeMode ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.04)', borderColor: isFridgeMode ? 'var(--accent-primary)' : 'var(--border-light)' }}
              title={t('toggleFridgeMode')}
            >
              <Tablet size={13} />
              <span className="hide-on-mobile">{t('fridgeMode')}</span>
            </button>

            {/* Alternador de Tema (Modo Claro / Escuro) */}
            <button
              onClick={toggleTheme}
              className="btn-secondary"
              style={{
                padding: '6px',
                borderRadius: '50%',
                minWidth: '32px',
                height: '32px',
                border: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255, 255, 255, 0.04)',
                cursor: 'pointer',
                transition: 'transform var(--transition-fast)'
              }}
              title={theme === 'dark' ? t('switchToLightMode') : t('switchToDarkMode')}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {theme === 'dark' ? (
                <Sun size={13} style={{ color: '#f59e0b' }} />
              ) : (
                <Moon size={13} style={{ color: '#7c3aed' }} />
              )}
            </button>

            {/* Configurações (Ajustes) */}
            <button
              onClick={() => setActiveTab('settings')}
              className={activeTab === 'settings' ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '6px', borderRadius: '50%', minWidth: '32px', height: '32px', border: activeTab === 'settings' ? 'none' : '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title={t('settings')}
            >
              <Settings size={13} style={{ color: activeTab === 'settings' ? '#fff' : 'var(--text-secondary)' }} />
            </button>

            {/* Logout */}
            <button onClick={handleLogout} className="btn-secondary" style={{ padding: '6px', borderRadius: '50%', minWidth: '32px', height: '32px' }} title={t('disconnectFromApp')}>
              <LogOut size={13} style={{ color: 'var(--text-secondary)' }} />
            </button>

          </div>
        </header>
      )}



      {/* CONTEÚDO PRINCIPAL DO APP */}
      <main className="main-content" style={{ padding: isFridgeMode ? '16px' : undefined }}>
        
        {/* SE FOR MODO GELADEIRA (FRIDGE TV MODE) */}
        {isFridgeMode ? (
          <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', flex: 1 }}>
            
            {/* Bloco 1: Tarefas do Dia */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <CheckSquare size={20} style={{ color: 'var(--accent-primary)' }} />
                <span>{t('todayTasksAndMeds')} ({currentDayName})</span>
              </h3>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '500px' }}>
                {(() => {
                  const todayStr = getTodayStr();
                  const sortedTasks = [...visibleChores]
                    .filter(c => isChoreActiveOnDate(c, todayStr))
                    .sort(sortChoresChronologically);

                  if (sortedTasks.length === 0) {
                    return (
                      <div className="animate-fade-in" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', height: '100%', minHeight: '220px' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)', border: '1px solid rgba(139, 92, 246, 0.15)', boxShadow: '0 0 15px rgba(139, 92, 246, 0.1)' }}>
                          <CheckSquare size={24} />
                        </div>
                        <div style={{ maxWidth: '280px' }}>
                          <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 6px 0' }}>{t('noTasksToday')}</h4>
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>{t('noTasksTodayDesc')}</p>
                        </div>
                      </div>
                    );
                  }

                  return sortedTasks.map(chore => {
                    const completed = isChoreCompletedOnDate(chore, todayStr);
                    const dose = getMedicationDoseOnDate(chore, todayStr, language);
                    return (
                      <div
                        key={chore.id}
                        onClick={() => handleCompleteChore(chore.id, todayStr)}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', borderRadius: 'var(--radius-md)', background: completed ? 'rgba(16, 185, 129, 0.04)' : 'rgba(255,255,255,0.02)', border: '1px solid', borderColor: completed ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-light)', cursor: 'pointer', transition: 'all 0.2s' }}
                      >
                        <div style={{ width: '22px', height: '22px', borderRadius: '6px', border: '2px solid', borderColor: completed ? 'var(--accent-success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: completed ? 'var(--accent-success)' : 'transparent', color: '#fff' }}>
                          {completed && <Check size={14} strokeWidth={3} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <p style={{ fontSize: '15px', fontWeight: '600', textDecoration: completed ? 'line-through' : 'none', color: completed ? 'var(--text-muted)' : 'var(--text-primary)', margin: 0 }}>
                              {chore.title}
                            </p>
                            
                            {/* Selo de Horário */}
                            {chore.time_type === 'fixed' && (
                              <span style={{ fontSize: '10px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)', padding: '1px 6px', borderRadius: '4px', color: 'var(--accent-primary-hover)' }}>
                                ⏰ {chore.fixed_time}
                              </span>
                            )}
                            {chore.time_type === 'period' && (
                              <span style={{ fontSize: '10px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '1px 6px', borderRadius: '4px', color: 'var(--accent-warning)' }}>
                                {chore.period_time === 'manha' ? '🌅 Manhã' : chore.period_time === 'tarde' ? '☀️ Tarde' : '🌙 Noite'}
                              </span>
                            )}
                            {chore.time_type === 'all_day' && (
                              <span style={{ fontSize: '10px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '1px 6px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                                📅 Dia Todo
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
                            {chore.is_medication && (
                              <span className="badge-xp" style={{ background: 'rgba(6, 182, 212, 0.12)', color: 'var(--accent-info)', border: '1px solid rgba(6, 182, 212, 0.2)', fontSize: '10px' }}>
                                Dose Hoje: {dose}
                              </span>
                            )}
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              Resp: <strong>{chore.assigned_to === 'all' ? 'Livre' : chore.assigned_to}</strong>
                            </span>
                            {chore.co_responsible && chore.co_responsible !== 'none' && (
                              <span style={{ fontSize: '11px', color: 'var(--accent-primary-hover)' }}>
                                👥 Co-resp: <strong>{chore.co_responsible}</strong>
                              </span>
                            )}
                          </div>
                        </div>
                        {gamificationEnabled && <span className="badge-xp">+{chore.points_worth} XP</span>}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Bloco 2: Lista de Compras */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <ShoppingCart size={20} style={{ color: 'var(--accent-warning)' }} />
                <span>{t('homeShoppingList')}</span>
              </h3>

              {/* Formulário de Adição Rápida */}
              <form onSubmit={handleFridgeAddShoppingItem} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="text"
                  value={fridgeShoppingInput}
                  onChange={(e) => setFridgeShoppingInput(e.target.value)}
                  placeholder={isAddingShoppingItem ? t('classifyingAi') : t('addShoppingItemPlaceholder')}
                  disabled={isAddingShoppingItem}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    outline: 'none',
                    transition: 'all 0.2s',
                    borderColor: fridgeShoppingInput.trim() ? 'rgba(245, 158, 11, 0.3)' : 'var(--border-light)'
                  }}
                />
                <button
                  type="submit"
                  disabled={!fridgeShoppingInput.trim() || isAddingShoppingItem}
                  className="btn-primary"
                  style={{
                    padding: '0 16px',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    background: fridgeShoppingInput.trim() && !isAddingShoppingItem ? 'linear-gradient(135deg, var(--accent-warning), #d97706)' : 'rgba(255,255,255,0.05)',
                    color: fridgeShoppingInput.trim() && !isAddingShoppingItem ? 'black' : 'var(--text-muted)',
                    cursor: fridgeShoppingInput.trim() && !isAddingShoppingItem ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    boxShadow: fridgeShoppingInput.trim() && !isAddingShoppingItem ? '0 4px 12px rgba(245, 158, 11, 0.2)' : 'none'
                  }}
                >
                  {isAddingShoppingItem ? <RefreshCw size={14} className="animate-spin" style={{ color: 'var(--text-muted)' }} /> : <Plus size={14} style={{ strokeWidth: 3 }} />}
                </button>
              </form>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '440px' }}>
                {(() => {
                  if (localShopping.length === 0) {
                    return (
                      <div className="animate-fade-in" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', height: '100%', minHeight: '220px' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-warning)', border: '1px solid rgba(245, 158, 11, 0.15)', boxShadow: '0 0 15px rgba(245, 158, 11, 0.1)' }}>
                          <ShoppingCart size={24} />
                        </div>
                        <div style={{ maxWidth: '280px' }}>
                          <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 6px 0' }}>{t('pantryFull')}</h4>
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>{t('noPendingItems')}</p>
                        </div>
                      </div>
                    );
                  }

                  const sortedShopping = [...localShopping].sort((a, b) => a.checked - b.checked);

                  return sortedShopping.map(item => {
                    const checked = item.checked === 1;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleToggleShoppingItem(item.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 4px', borderBottom: '1px solid var(--border-light)', background: 'transparent', cursor: 'pointer', opacity: checked ? 0.5 : 1, transition: 'all 0.2s' }}
                        onMouseEnter={(e) => { if (!checked) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: '2px solid', borderColor: checked ? 'var(--accent-warning)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: checked ? 'var(--accent-warning)' : 'transparent', color: '#000' }}>
                          {checked && <Check size={12} strokeWidth={3} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '14px', fontWeight: '600', textDecoration: checked ? 'line-through' : 'none', margin: 0, color: checked ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                            {item.name}
                          </p>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            Qtd: {item.quantity} | Por: {item.added_by}
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Bloco 3: Dashboard de Gamificação / Status Família */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                {gamificationEnabled ? (
                  <>
                    <Trophy size={20} style={{ color: 'var(--accent-success)' }} />
                    <span>{t('leaderboardWeekly')}</span>
                  </>
                ) : (
                  <>
                    <CheckSquare size={20} style={{ color: 'var(--accent-primary)' }} />
                    <span>{t('familyProgressTitle')}</span>
                  </>
                )}
              </h3>
              
              {/* Progresso Geral de Hoje */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '20px', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>{t('todayTasksProgress')}</p>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${choreProgressToday.percentage}%`, background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-success))', transition: 'width 0.4s' }}></div>
                </div>
                <h4 style={{ fontSize: '24px', fontWeight: '700', marginTop: '12px' }}>{choreProgressToday.percentage}%</h4>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('tasksCompletedOf').replace('{completed}', String(choreProgressToday.completed)).replace('{total}', String(choreProgressToday.total))}</p>
              </div>

              {/* Tabela de Ranking de XP */}
              {gamificationEnabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {Object.entries(userStats)
                    .sort((a, b) => b[1].points - a[1].points)
                    .map(([name, stats], index) => (
                      <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ fontSize: '16px', fontWeight: '700', width: '24px', color: index === 0 ? 'var(--accent-warning)' : 'var(--text-secondary)' }}>
                          #{index + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '14px', fontWeight: '600' }}>{stats.displayName || name}</p>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('levelLabel').replace('{level}', String(stats.level))}</span>
                        </div>
                        <span className="badge-xp" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-success)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                          {stats.points} XP
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>

          </div>
        ) : (
          // SE FOR MODO COMPLETO (SPA MULTIABA COMPLETA)
          <>
            {/* ABAS DE NAVEGAÇÃO SUPERIOR (Responsivas para Mobile) */}
            <nav className="glass-panel main-nav">
              <button onClick={() => setActiveTab('dashboard')} className={activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, border: 'none', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '14px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LayoutDashboard size={16} /> <span className="nav-btn-text" style={{ marginLeft: '4px' }}>{t('dashboard')}</span>
              </button>
              <button onClick={() => setActiveTab('calendar')} className={activeTab === 'calendar' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, border: 'none', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '14px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CalendarIcon size={16} /> <span className="nav-btn-text" style={{ marginLeft: '4px' }}>{t('calendar')}</span>
              </button>
              <button onClick={() => setActiveTab('shopping')} className={activeTab === 'shopping' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, border: 'none', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '14px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingCart size={16} /> <span className="nav-btn-text" style={{ marginLeft: '4px' }}>{t('shoppingList')}</span>
              </button>

              {gamificationEnabled && (
                <>
                  <button onClick={() => setActiveTab('gamification')} className={activeTab === 'gamification' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, border: 'none', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '14px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trophy size={16} /> <span className="nav-btn-text" style={{ marginLeft: '4px' }}>{t('gamification')}</span>
                  </button>
                  <button onClick={() => setActiveTab('reports')} className={activeTab === 'reports' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, border: 'none', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '14px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BarChart3 size={16} /> <span className="nav-btn-text" style={{ marginLeft: '4px' }}>{t('reportsTab')}</span>
                  </button>
                </>
              )}
            </nav>

            {/* CONTEÚDO DAS ABAS */}
            <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column' }}>

              {/* ABA 1: DASHBOARD */}
              {activeTab === 'dashboard' && (() => {
                const getGreeting = () => {
                  const hr = currentTime.getHours();
                  if (hr >= 5 && hr < 12) return t('greetingMorning');
                  if (hr >= 12 && hr < 18) return t('greetingAfternoon');
                  return t('greetingEvening');
                };

                const getWeatherInfo = () => {
                  const hr = currentTime.getHours();
                  if (hr >= 6 && hr < 12) {
                    return {
                      temp: '22°C',
                      desc: t('weatherMorning'),
                      icon: <Sun className="animate-pulse" size={24} style={{ color: 'var(--accent-warning)' }} />,
                      glow: 'rgba(245, 158, 11, 0.15)'
                    };
                  } else if (hr >= 12 && hr < 18) {
                    return {
                      temp: '26°C',
                      desc: t('weatherAfternoon'),
                      icon: <Sun size={24} style={{ color: 'var(--accent-warning)', animation: 'spin 20s linear infinite' }} />,
                      glow: 'rgba(245, 158, 11, 0.15)'
                    };
                  } else if (hr >= 18 && hr < 22) {
                    return {
                      temp: '20°C',
                      desc: t('weatherEvening'),
                      icon: <Sparkles size={24} style={{ color: 'var(--accent-primary-hover)' }} />,
                      glow: 'rgba(139, 92, 246, 0.15)'
                    };
                  } else {
                    return {
                      temp: '17°C',
                      desc: t('weatherNight'),
                      icon: <CloudRain size={24} style={{ color: 'var(--accent-info)' }} />,
                      glow: 'rgba(6, 182, 212, 0.15)'
                    };
                  }
                };

                const weather = getWeatherInfo();

                return (
                  <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* LINHA SUPERIOR: GREETING & MURAL */}
                    <div className="mural-row-desktop" style={{ display: 'grid', gap: '24px' }}>
                      {/* CARTÃO DE BOAS-VINDAS + CLIMA */}
                      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center', background: `radial-gradient(circle at top right, ${weather.glow}, transparent 65%), var(--bg-glass)` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <span className="badge-xp" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)', fontSize: '10px' }}>
                              🏠 {t('controlCenter')}
                            </span>
                            <h2 style={{ fontSize: '24px', fontWeight: '800', marginTop: '8px', marginBottom: '2px', color: '#fff' }}>
                              {getGreeting()}, {currentUser ? (currentUser.display_name || currentUser.username) : 'Família'}!
                            </h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '500' }}>
                              {getLocalizedDate(currentTime, language)}
                            </p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                            {weather.icon}
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '16px', fontWeight: '800', color: '#fff', lineHeight: 1 }}>{weather.temp}</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', marginTop: '2px' }}>{weather.desc}</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '14px', fontSize: '20px', fontWeight: '700', color: 'var(--accent-primary-hover)' }}>
                          <Clock size={20} style={{ color: 'var(--accent-primary)' }} />
                          <span>{currentTime.toLocaleTimeString(LOCALE_MAP[language] || 'en-US')}</span>
                        </div>
                      </div>

                      {/* MURAL DE AVISOS DA FAMÍLIA */}
                      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
                          <div>
                            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Pin size={18} style={{ color: 'var(--accent-danger)', transform: 'rotate(15deg)' }} />
                              <span>{t('stickyNotesTitle')}</span>
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0 }}>{t('stickyNotesDesc')}</p>
                          </div>
                          
                          {!isAddingSticky ? (
                            <button
                              onClick={() => setIsAddingSticky(true)}
                              className="btn-primary"
                              style={{ padding: '6px 12px', fontSize: '11px', borderRadius: 'var(--radius-sm)' }}
                            >
                              {t('addNote')}
                            </button>
                          ) : (
                            <button
                              onClick={() => setIsAddingSticky(false)}
                              className="btn-secondary"
                              style={{ padding: '6px 12px', fontSize: '11px', borderRadius: 'var(--radius-sm)' }}
                            >
                              {t('cancel')}
                            </button>
                          )}
                        </div>

                        {isAddingSticky && (
                          <div className="animate-scale-up" style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <textarea
                              className="input-field"
                              placeholder={t('notePlaceholder')}
                              maxLength={80}
                              value={newStickyText}
                              onChange={(e) => setNewStickyText(e.target.value)}
                              style={{ minHeight: '60px', fontSize: '13px', resize: 'none', padding: '10px' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                {(['yellow', 'blue', 'green', 'pink', 'purple'] as const).map((col) => {
                                  const colorMap = {
                                    yellow: '#fde047',
                                    blue: '#93c5fd',
                                    green: '#6ee7b7',
                                    pink: '#fbcfe8',
                                    purple: '#c084fc'
                                  };
                                  return (
                                    <button
                                      key={col}
                                      onClick={() => setNewStickyColor(col)}
                                      style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        background: colorMap[col],
                                        border: newStickyColor === col ? '2px solid #fff' : '2px solid transparent',
                                        cursor: 'pointer',
                                        boxShadow: newStickyColor === col ? '0 0 8px rgba(255,255,255,0.4)' : 'none',
                                        transition: 'all 0.15s'
                                      }}
                                    />
                                  );
                                })}
                              </div>
                              <button
                                onClick={handleAddStickyNote}
                                className="btn-primary"
                                style={{ padding: '6px 12px', fontSize: '12px', borderRadius: 'var(--radius-sm)' }}
                              >
                                {t('publish')}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="sticky-notes-container" style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                          {stickyNotes.length === 0 ? (
                            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>
                              📌 {t('emptyBoardMessage')}
                            </div>
                          ) : (
                            stickyNotes.map((note: any) => (
                              <div key={note.id} className={`sticky-note sticky-${note.color} animate-scale-up`}>
                                <p style={{ fontSize: '12px', fontWeight: '600', margin: 0, lineHeight: 1.4, wordBreak: 'break-word', color: 'var(--text-primary)' }}>
                                  "{note.text}"
                                </p>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                                  <span style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', opacity: 0.8 }}>
                                    ✍️ {note.sender}
                                  </span>
                                  {(currentUser?.role === 'admin' || note.sender === currentUser?.username) && (
                                    <button
                                      onClick={() => handleDeleteStickyNote(note.id)}
                                      style={{
                                        border: 'none',
                                        background: 'none',
                                        color: 'inherit',
                                        cursor: 'pointer',
                                        padding: '2px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        opacity: 0.6,
                                        transition: 'opacity 0.2s'
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                      onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                                      title={t('removeWarning')}
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ROTEIRO DA FAMÍLIA (CHECKLIST DE TAREFAS DO DIA) */}
                    <div style={{ width: '100%' }}>
                      {/* 2. Checklist de Tarefas do Dia Selecionado */}
                      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
                        <div>
                          <p style={{ fontSize: '10px', color: 'var(--accent-primary-hover)', fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>{t('routines')}</p>
                          <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px', margin: '2px 0 0 0' }}>
                            <CheckSquare size={16} style={{ color: 'var(--accent-primary)' }} />
                            <span>
                              {(() => {
                                const formattedDate = calendarSelectedDate.toLocaleDateString(language === 'pt' ? 'pt-BR' : language, { weekday: 'long', day: 'numeric', month: 'long' });
                                return formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
                              })()}
                            </span>
                          </h3>
                        </div>
                        {currentUser && (
                          <button
                            onClick={() => {
                              const year = calendarSelectedDate.getFullYear();
                              const month = String(calendarSelectedDate.getMonth() + 1).padStart(2, '0');
                              const day = String(calendarSelectedDate.getDate()).padStart(2, '0');
                              setNewChoreStartDate(`${year}-${month}-${day}`);
                              setShowChoreFormModal(true);
                            }}
                            className="btn-primary"
                            style={{ padding: '6px 10px', fontSize: '11px', borderRadius: 'var(--radius-sm)' }}
                            title={t('createChoreForSelectedDay')}
                          >
                            + {t('createNewChore')}
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
                        {(() => {
                          const year = calendarSelectedDate.getFullYear();
                          const month = String(calendarSelectedDate.getMonth() + 1).padStart(2, '0');
                          const day = String(calendarSelectedDate.getDate()).padStart(2, '0');
                          const selectedDateStr = `${year}-${month}-${day}`;

                          const targetChores = visibleChores
                            .filter(c => isChoreActiveOnDate(c, selectedDateStr))
                            .sort(sortChoresChronologically);

                          if (targetChores.length === 0) {
                            return (
                              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '13px' }}>
                                💤 {t('noChoresForDate')}
                              </div>
                            );
                          }

                          // Agrupamento por período
                          const manhaChores: Chore[] = [];
                          const tardeChores: Chore[] = [];
                          const noiteChores: Chore[] = [];
                          const flexivelChores: Chore[] = [];

                          targetChores.forEach(chore => {
                            if (chore.time_type === 'period') {
                              if (chore.period_time === 'manha') manhaChores.push(chore);
                              else if (chore.period_time === 'tarde') tardeChores.push(chore);
                              else if (chore.period_time === 'noite') noiteChores.push(chore);
                              else flexivelChores.push(chore);
                            } else if (chore.time_type === 'fixed' && chore.fixed_time) {
                              const time = chore.fixed_time;
                              if (time >= '05:00' && time <= '11:59') {
                                manhaChores.push(chore);
                              } else if (time >= '12:00' && time <= '17:59') {
                                tardeChores.push(chore);
                              } else {
                                noiteChores.push(chore);
                              }
                            } else {
                              flexivelChores.push(chore);
                            }
                          });

                          const categories = [
                            { id: 'manha', label: t('periodMorning'), icon: '🌅', color: 'var(--accent-warning)', items: manhaChores },
                            { id: 'tarde', label: t('periodAfternoon'), icon: '☀️', color: 'var(--accent-info)', items: tardeChores },
                            { id: 'noite', label: t('periodEvening'), icon: '🌙', color: 'var(--accent-primary-hover)', items: noiteChores },
                            { id: 'flexivel', label: t('periodFlexible'), icon: '📅', color: 'var(--text-secondary)', items: flexivelChores }
                          ];

                          const activeCategories = categories.filter(cat => cat.items.length > 0);

                          return activeCategories.map(cat => (
                            <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '4px', marginBottom: '2px' }}>
                                <span style={{ fontSize: '13px' }}>{cat.icon}</span>
                                <span style={{ fontSize: '11px', fontWeight: '800', color: cat.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{cat.label}</span>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto', fontWeight: 'bold' }}>{cat.items.length} {cat.items.length === 1 ? t('choreSingle') : t('chorePlural')}</span>
                              </div>
                              <div className="dashboard-chores-list-grid">
                                {cat.items.map(chore => {
                                  const completed = isChoreCompletedOnDate(chore, selectedDateStr);
                                  const isMed = !!chore.is_medication;
                                  const dose = isMed ? getMedicationDoseOnDate(chore, selectedDateStr, language) : '';

                                  return (
                                    <div
                                      key={chore.id}
                                      className={`sidebar-task-item ${completed ? 'completed' : ''}`}
                                      onClick={() => handleEditChoreClick(chore)}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        background: completed ? 'rgba(16, 185, 129, 0.02)' : 'rgba(255, 255, 255, 0.015)',
                                        padding: '10px 12px',
                                        borderRadius: 'var(--radius-sm)',
                                        borderLeft: '4px solid',
                                        borderLeftColor: completed ? 'var(--accent-success)' : (isMed ? 'var(--accent-info)' : 'var(--accent-primary)'),
                                        borderTop: '1px solid rgba(255, 255, 255, 0.01)',
                                        borderRight: '1px solid rgba(255, 255, 255, 0.01)',
                                        borderBottom: '1px solid rgba(255, 255, 255, 0.01)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                      }}
                                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = completed ? 'rgba(16, 185, 129, 0.04)' : 'rgba(255, 255, 255, 0.035)'; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = completed ? 'rgba(16, 185, 129, 0.02)' : 'rgba(255, 255, 255, 0.015)'; }}
                                    >
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginBottom: '2px' }}>
                                          <p
                                            style={{
                                              fontSize: '13px',
                                              fontWeight: '700',
                                              textDecoration: completed ? 'line-through' : 'none',
                                              margin: 0,
                                              color: completed ? 'var(--text-muted)' : 'var(--text-primary)',
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis',
                                              whiteSpace: 'nowrap',
                                              maxWidth: '100%'
                                            }}
                                          >
                                            {chore.title}
                                          </p>
                                          {isMed ? (
                                            <span style={{ fontSize: '8px', background: 'rgba(6, 182, 212, 0.15)', padding: '1px 4px', borderRadius: '3px', color: 'var(--accent-info)', fontWeight: 'bold' }}>💊</span>
                                          ) : (
                                            <span style={{ fontSize: '8px', background: 'rgba(139, 92, 246, 0.15)', padding: '1px 4px', borderRadius: '3px', color: 'var(--accent-primary-hover)', fontWeight: 'bold' }}>📅</span>
                                          )}
                                          {chore.time_type === 'fixed' && (
                                            <span style={{ fontSize: '8px', background: 'rgba(255, 255, 255, 0.05)', padding: '1px 4px', borderRadius: '3px', color: 'var(--text-secondary)' }}>⏰ {chore.fixed_time}</span>
                                          )}
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t('responsibleLabel')} <strong>{chore.assigned_to === 'all' ? t('allLabel') : (chore.assigned_to === currentUser?.username ? t('youLabel') : chore.assigned_to)}</strong></span>
                                          {isMed && dose && (
                                            <span style={{ fontSize: '10px', color: 'var(--accent-info)' }}>({dose})</span>
                                          )}
                                          {gamificationEnabled && (
                                            <span className="badge-xp" style={{ fontSize: '9px', padding: '0 4px' }}>+{chore.points_worth} XP</span>
                                          )}
                                        </div>
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCompleteChore(chore.id, selectedDateStr);
                                        }}
                                        className="btn-secondary"
                                        style={{
                                          padding: '4px 10px',
                                          fontSize: '11px',
                                          background: completed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.04)',
                                          borderColor: completed ? 'var(--accent-success)' : 'var(--border-light)',
                                          color: completed ? 'var(--accent-success)' : 'var(--text-primary)',
                                          borderRadius: 'var(--radius-sm)',
                                          flexShrink: 0
                                        }}
                                      >
                                        {completed ? 'Feito' : 'Fazer'}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                    </div>
              </div>
            );
          })()}
              {/* ABA 1.5: CALENDÁRIO DEDICADO */}
              {activeTab === 'calendar' && (() => {
                return (
                  <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {(() => {
                    const monthsPT = getLocalizedMonths(language);
                    const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay();
                    const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();
                    const today = new Date();

                    // 1. Helpers de Filtro e Sincronização Local
                    const getCalendarFilteredChores = (dateStr: string) => {
                      return visibleChores.filter(chore => {
                        if (!isChoreActiveOnDate(chore, dateStr)) return false;

                        // Filtro de Responsável
                        if (filterChoreUser !== 'all') {
                          if (filterChoreUser === 'all-family') {
                            if (chore.assigned_to !== 'all') return false;
                          } else {
                            if (chore.assigned_to !== filterChoreUser && chore.co_responsible !== filterChoreUser) return false;
                          }
                        }

                        // Filtro de Tipo
                        if (filterChoreType !== 'all') {
                          const isMed = !!chore.is_medication;
                          if (filterChoreType === 'routine' && isMed) return false;
                          if (filterChoreType === 'medication' && !isMed) return false;
                        }

                        return true;
                      }).sort(sortChoresChronologically);
                    };

                    const getActiveWeekDays = (anchorDate: Date): Date[] => {
                      const days = [];
                      const sunday = new Date(anchorDate);
                      sunday.setDate(anchorDate.getDate() - anchorDate.getDay());
                      for (let i = 0; i < 7; i++) {
                        const day = new Date(sunday);
                        day.setDate(sunday.getDate() + i);
                        days.push(day);
                      }
                      return days;
                    };

                    const formatDateToYYYYMMDD = (d: Date): string => {
                      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    };

                    // Lógica de Navegação Unificada
                    const handlePrevPeriod = () => {
                      if (calendarView === 'month') {
                        let newMonth = calendarMonth - 1;
                        let newYear = calendarYear;
                        if (calendarMonth === 0) {
                          newMonth = 11;
                          newYear = calendarYear - 1;
                        }
                        setCalendarMonth(newMonth);
                        setCalendarYear(newYear);
                        setCalendarSelectedDate(new Date(newYear, newMonth, 1));
                      } else if (calendarView === 'week') {
                        const nextDate = new Date(calendarSelectedDate);
                        nextDate.setDate(calendarSelectedDate.getDate() - 7);
                        setCalendarSelectedDate(nextDate);
                        setCalendarMonth(nextDate.getMonth());
                        setCalendarYear(nextDate.getFullYear());
                      } else {
                        const nextDate = new Date(calendarSelectedDate);
                        nextDate.setDate(calendarSelectedDate.getDate() - 1);
                        setCalendarSelectedDate(nextDate);
                        setCalendarMonth(nextDate.getMonth());
                        setCalendarYear(nextDate.getFullYear());
                      }
                    };

                    const handleNextPeriod = () => {
                      if (calendarView === 'month') {
                        let newMonth = calendarMonth + 1;
                        let newYear = calendarYear;
                        if (calendarMonth === 11) {
                          newMonth = 0;
                          newYear = calendarYear + 1;
                        }
                        setCalendarMonth(newMonth);
                        setCalendarYear(newYear);
                        setCalendarSelectedDate(new Date(newYear, newMonth, 1));
                      } else if (calendarView === 'week') {
                        const nextDate = new Date(calendarSelectedDate);
                        nextDate.setDate(calendarSelectedDate.getDate() + 7);
                        setCalendarSelectedDate(nextDate);
                        setCalendarMonth(nextDate.getMonth());
                        setCalendarYear(nextDate.getFullYear());
                      } else {
                        const nextDate = new Date(calendarSelectedDate);
                        nextDate.setDate(calendarSelectedDate.getDate() + 1);
                        setCalendarSelectedDate(nextDate);
                        setCalendarMonth(nextDate.getMonth());
                        setCalendarYear(nextDate.getFullYear());
                      }
                    };

                    // Formatar o cabeçalho temporal conforme a perspectiva
                    let dateHeaderTitle: string;
                    if (calendarView === 'month') {
                      const dummyDate = new Date(calendarYear, calendarMonth, 1);
                      const monthStr = dummyDate.toLocaleDateString(language === 'pt' ? 'pt-BR' : language, { month: 'long' });
                      dateHeaderTitle = `${monthStr.charAt(0).toUpperCase() + monthStr.slice(1)} ${calendarYear}`;
                    } else if (calendarView === 'week') {
                      const weekDays = getActiveWeekDays(calendarSelectedDate);
                      const firstDay = weekDays[0];
                      const lastDay = weekDays[6];
                      const firstMonthStr = firstDay.toLocaleDateString(language === 'pt' ? 'pt-BR' : language, { month: 'short' }).replace('.', '');
                      const lastMonthStr = lastDay.toLocaleDateString(language === 'pt' ? 'pt-BR' : language, { month: 'short' }).replace('.', '');
                      dateHeaderTitle = `${firstDay.getDate()} ${firstMonthStr} - ${lastDay.getDate()} ${lastMonthStr} (${lastDay.getFullYear()})`;
                    } else {
                      const dayStr = calendarSelectedDate.toLocaleDateString(language === 'pt' ? 'pt-BR' : language, { weekday: 'long', day: 'numeric', month: 'long' });
                      dateHeaderTitle = dayStr.charAt(0).toUpperCase() + dayStr.slice(1);
                    }

                    // Células mensais
                    const cells = [];
                    for (let i = 0; i < firstDayIndex; i++) {
                      cells.push({ type: 'empty', id: `empty-${i}` });
                    }
                    for (let d = 1; d <= totalDays; d++) {
                      cells.push({ type: 'day', dayNumber: d, id: `day-${d}` });
                    }

                    return (
                      <div className="glass-panel" style={{ padding: '24px', position: 'relative', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        
                        {/* CABEÇALHO DO CALENDÁRIO COM SELETORES */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '4px' }}>
                          <div>
                            <h3 style={{ fontSize: '20px', fontWeight: '700' }}>{t('familyCalendar')}</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{t('calendarSubtitle')}</p>
                          </div>

                          {/* Seletor de Perspectivas */}
                          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.03)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                            {(['month', 'week', 'day'] as const).map((view) => (
                              <button
                                key={view}
                                onClick={() => setCalendarView(view)}
                                style={{
                                  padding: '6px 14px',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                  background: calendarView === view ? 'var(--accent-primary)' : 'transparent',
                                  color: calendarView === view ? '#fff' : 'var(--text-secondary)',
                                  border: 'none',
                                  borderRadius: 'calc(var(--radius-md) - 2px)',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px'
                                }}
                              >
                                {view === 'month' ? t('month') : view === 'week' ? t('week') : t('day')}
                              </button>
                            ))}
                          </div>

                          {/* Controles de Navegação */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-glass)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                            <button
                              onClick={handlePrevPeriod}
                              style={{ border: 'none', background: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', transition: 'transform 0.15s ease' }}
                              title={t('back')}
                            >
                              <ChevronLeft size={18} />
                            </button>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', minWidth: '150px', textAlign: 'center' }}>
                              {dateHeaderTitle}
                            </span>
                            <button
                              onClick={handleNextPeriod}
                              style={{ border: 'none', background: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', transition: 'transform 0.15s ease' }}
                              title={t('forward')}
                            >
                              <ChevronRight size={18} />
                            </button>
                          </div>
                        </div>

                        {/* FILTROS INTEGRADOS AO CALENDÁRIO */}
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '4px', background: 'rgba(255,255,255,0.01)', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', alignSelf: 'center' }}>{t('filters')}</span>
                          <div>
                            <select className="input-field" style={{ padding: '4px 10px', height: '32px', fontSize: '12px', width: '130px', margin: 0 }} value={filterChoreUser} onChange={(e) => setFilterChoreUser(e.target.value)}>
                              <option value="all">{t('memberAll')}</option>
                              <option value="all-family">{t('familyCollective')}</option>
                              {familyMembers.map(m => (
                                <option key={m.id} value={m.username}>{m.display_name || m.username}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <select className="input-field" style={{ padding: '4px 10px', height: '32px', fontSize: '12px', width: '130px', margin: 0 }} value={filterChoreType} onChange={(e) => setFilterChoreType(e.target.value)}>
                              <option value="all">{t('typeAll')}</option>
                              <option value="routine">{t('onlyRoutines')}</option>
                              <option value="medication">{t('onlyMedications')}</option>
                            </select>
                          </div>
                        </div>

                        {/* RENDERIZAÇÃO DE PERSPECTIVAS */}

                        {/* PERSPECTIVA 1: MENSAL (MONTH VIEW) */}
                        {calendarView === 'month' && (
                          <div className="calendar-grid-month animate-fade-in">
                            {getLocalizedWeekdays(language, 'short').map((day, idx) => (
                              <div key={idx} style={{ textAlign: 'center', fontWeight: '700', color: 'var(--accent-primary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: '6px', borderBottom: '1px solid var(--border-light)' }}>
                                {day}
                              </div>
                            ))}

                            {cells.map((cell, idx) => {
                              if (cell.type === 'empty') {
                                  return (
                                    <div
                                      key={`empty-${idx}`}
                                      className="calendar-month-cell"
                                      style={{ border: '1px solid transparent', background: 'transparent', cursor: 'default' }}
                                    />
                                  );
                              }

                              const dayNumber = cell.dayNumber!;
                              const cellDateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
                              const isTodayCell = today.getDate() === dayNumber && today.getMonth() === calendarMonth && today.getFullYear() === calendarYear;
                              const isSelectedCell = calendarSelectedDate.getDate() === dayNumber && calendarSelectedDate.getMonth() === calendarMonth && calendarSelectedDate.getFullYear() === calendarYear;

                              // Filtros de tarefas
                              const choresOnThisDay = getCalendarFilteredChores(cellDateStr);
                              const completedCount = choresOnThisDay.filter(c => isChoreCompletedOnDate(c, cellDateStr)).length;
                              const totalCount = choresOnThisDay.length;
                              const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

                              return (
                                <div
                                  key={`day-${dayNumber}`}
                                  onClick={() => {
                                    setCalendarSelectedDate(new Date(calendarYear, calendarMonth, dayNumber));
                                    setCalendarView('day');
                                  }}
                                  className={`calendar-month-cell glass-panel-hover ${isSelectedCell ? 'selected' : ''}`}
                                  style={{
                                    borderColor: isSelectedCell ? 'var(--accent-primary)' : (isTodayCell ? 'rgba(255, 255, 255, 0.25)' : 'var(--border-light)'),
                                    background: isSelectedCell ? 'rgba(139, 92, 246, 0.1)' : (isTodayCell ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255,255,255,0.01)'),
                                    boxShadow: isSelectedCell ? 'var(--shadow-glow)' : 'none',
                                    transition: 'all 0.2s',
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '11px', fontWeight: isTodayCell || isSelectedCell ? '700' : '500', color: isSelectedCell ? 'var(--accent-primary-hover)' : (isTodayCell ? '#fff' : 'var(--text-secondary)') }}>
                                      {dayNumber} {isTodayCell && `(${t('today')})`}
                                    </span>
                                    {totalCount > 0 && (
                                      <span style={{ fontSize: '9px', fontWeight: 'bold', color: progressPercent === 100 ? 'var(--accent-success)' : 'var(--text-muted)' }}>
                                        {completedCount}/{totalCount}
                                      </span>
                                    )}
                                  </div>

                                  {/* Barra de progresso diária */}
                                  {totalCount > 0 && (
                                    <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden', marginBottom: '2px' }}>
                                      <div style={{ width: `${progressPercent}%`, height: '100%', background: progressPercent === 100 ? 'var(--accent-success)' : 'var(--accent-primary)', transition: 'width 0.3s ease' }} />
                                    </div>
                                  )}
                                  
                                  {/* Visão Desktop: Lista de Textos */}
                                  <div className="calendar-month-chores-list" style={{ flex: 1, flexDirection: 'column', gap: '3px', overflow: 'hidden' }}>
                                    {choresOnThisDay.slice(0, 3).map(chore => {
                                      const completed = isChoreCompletedOnDate(chore, cellDateStr);
                                      const category = getChoreColorCategory(chore);
                                      return (
                                        <div
                                          key={chore.id}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setCalendarSelectedDate(new Date(calendarYear, calendarMonth, dayNumber));
                                            handleEditChoreClick(chore);
                                          }}
                                          className={`calendar-chore-pill category-${category} ${completed ? 'completed' : ''}`}
                                          style={{
                                            fontSize: '9px',
                                            fontWeight: '600',
                                            padding: '2px 5px',
                                            borderRadius: '3px',
                                            textOverflow: 'ellipsis',
                                            overflow: 'hidden',
                                            whiteSpace: 'nowrap',
                                            cursor: 'pointer'
                                          }}
                                          title={`${chore.title} (${chore.assigned_to})`}
                                        >
                                          {chore.title}
                                        </div>
                                      );
                                    })}
                                    {choresOnThisDay.length > 3 && (
                                      <div style={{ fontSize: '8px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '2px', fontWeight: 'bold' }}>
                                        + {choresOnThisDay.length - 3} {t('more')}
                                      </div>
                                    )}
                                  </div>

                                  {/* Visão Mobile: Bolinhas Coloridas Compactas */}
                                  <div className="calendar-month-dots-container">
                                    {choresOnThisDay.map(chore => {
                                      const completed = isChoreCompletedOnDate(chore, cellDateStr);
                                      const category = getChoreColorCategory(chore);
                                      const dotBg = completed 
                                        ? 'var(--accent-success)' 
                                        : (category === 'medication' ? '#f43f5e' : category === 'work' ? '#f59e0b' : '#0ea5e9');
                                      return (
                                        <div
                                          key={`dot-${chore.id}`}
                                          style={{
                                            width: '6px',
                                            height: '6px',
                                            borderRadius: '50%',
                                            backgroundColor: dotBg,
                                          }}
                                          title={`${chore.title} (${chore.assigned_to})`}
                                        />
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* PERSPECTIVA 2: SEMANAL (WEEK VIEW) */}
                        {calendarView === 'week' && (() => {
                          const weekDays = getActiveWeekDays(calendarSelectedDate);
                          return (
                            <div className="calendar-grid-week animate-fade-in">
                              {weekDays.map(day => {
                                const cellDateStr = formatDateToYYYYMMDD(day);
                                const isTodayDay = today.getDate() === day.getDate() && today.getMonth() === day.getMonth() && today.getFullYear() === day.getFullYear();
                                const isSelectedDay = calendarSelectedDate.getDate() === day.getDate() && calendarSelectedDate.getMonth() === day.getMonth() && calendarSelectedDate.getFullYear() === day.getFullYear();
                                const choresOnThisDay = getCalendarFilteredChores(cellDateStr);
                                const completedCount = choresOnThisDay.filter(c => isChoreCompletedOnDate(c, cellDateStr)).length;
                                const totalCount = choresOnThisDay.length;
                                const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

                                return (
                                  <div
                                    key={cellDateStr}
                                    className={`calendar-week-card glass-panel ${isSelectedDay ? 'selected' : ''}`}
                                    style={{
                                      border: '1px solid',
                                      borderColor: isSelectedDay ? 'var(--accent-primary)' : (isTodayDay ? 'rgba(255, 255, 255, 0.25)' : 'var(--border-light)'),
                                      background: isSelectedDay ? 'rgba(139, 92, 246, 0.08)' : (isTodayDay ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255,255,255,0.01)'),
                                    }}
                                  >
                                    {/* Cabeçalho do dia da semana */}
                                    <div
                                      onClick={() => {
                                        setCalendarSelectedDate(new Date(day));
                                        setCalendarView('day');
                                      }}
                                      style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '6px', cursor: 'pointer' }}
                                    >
                                      <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 'bold', color: isSelectedDay ? 'var(--accent-primary-hover)' : (isTodayDay ? '#fff' : 'var(--text-muted)'), margin: 0 }}>
                                        {getLocalizedWeekdays(language, 'short')[day.getDay()]}
                                      </p>
                                      <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: '2px 0 0 0' }}>
                                        {day.getDate()} {monthsPT[day.getMonth()].substring(0,3)}
                                      </h4>
                                    </div>

                                    {/* Barra de progresso */}
                                    {totalCount > 0 && (
                                      <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '600' }}>
                                          <span>{completedCount}/{totalCount}</span>
                                        </div>
                                        <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                          <div style={{ width: `${progressPercent}%`, height: '100%', background: progressPercent === 100 ? 'var(--accent-success)' : 'var(--accent-primary)', transition: 'width 0.3s ease' }} />
                                        </div>
                                      </div>
                                    )}

                                    {/* Lista vertical de tarefas na semana */}
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', maxHeight: '160px' }}>
                                      {choresOnThisDay.length === 0 ? (
                                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic', margin: 'auto 0', textAlign: 'center' }}>{t('empty')}</p>
                                      ) : (
                                        choresOnThisDay.map(chore => {
                                          const completed = isChoreCompletedOnDate(chore, cellDateStr);
                                          return (
                                            <div
                                              key={chore.id}
                                              onClick={() => {
                                                setCalendarSelectedDate(new Date(day));
                                                handleEditChoreClick(chore);
                                              }}
                                              className="glass-panel-hover"
                                              style={{
                                                padding: '4px 6px',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                background: completed ? 'rgba(16, 185, 129, 0.03)' : 'rgba(255,255,255,0.02)',
                                                border: '1px solid',
                                                borderColor: completed ? 'rgba(16, 185, 129, 0.15)' : 'var(--border-light)',
                                                opacity: completed ? 0.65 : 1,
                                                transition: 'all 0.2s'
                                              }}
                                            >
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', maxWidth: '75%', overflow: 'hidden' }}>
                                                <span style={{ fontSize: '9px', fontWeight: '700', color: completed ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: completed ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                  {chore.title}
                                                </span>
                                              </div>

                                              {/* Checkbox interativo rápido */}
                                              <div
                                                onClick={async (e) => {
                                                  e.stopPropagation();
                                                  await handleCompleteChore(chore.id, cellDateStr);
                                                  showToast(`${completed ? t('reopened') : t('completed')}: "${chore.title}"!`, completed ? 'info' : 'success');
                                                }}
                                                style={{
                                                  width: '12px',
                                                  height: '12px',
                                                  borderRadius: '3px',
                                                  border: '1px solid',
                                                  borderColor: completed ? 'var(--accent-success)' : 'var(--text-muted)',
                                                  background: completed ? 'var(--accent-success)' : 'transparent',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  cursor: 'pointer',
                                                  color: '#fff',
                                                  fontSize: '7px'
                                                }}
                                              >
                                                {completed && <Check size={6} />}
                                              </div>
                                            </div>
                                          );
                                        })
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {/* PERSPECTIVA 3: DIÁRIA (DAY VIEW) */}
                        {calendarView === 'day' && (() => {
                          const cellDateStr = formatDateToYYYYMMDD(calendarSelectedDate);
                          const choresOnThisDay = getCalendarFilteredChores(cellDateStr);

                          return (
                            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <div className="glass-panel" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent-primary-hover)' }}>{t('detailedDayActivities')}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span className="badge-xp" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)' }}>
                                    {t('tasksCompletedOf')
                                      .replace('{completed}', String(choresOnThisDay.filter(c => isChoreCompletedOnDate(c, cellDateStr)).length))
                                      .replace('{total}', String(choresOnThisDay.length))
                                    }
                                  </span>
                                  {currentUser && (
                                    <button
                                      onClick={() => {
                                        setNewChoreStartDate(cellDateStr);
                                        setShowChoreFormModal(true);
                                      }}
                                      className="btn-primary"
                                      style={{ padding: '4px 8px', fontSize: '10px', borderRadius: 'var(--radius-sm)' }}
                                      title={t('createChoreForSelectedDay')}
                                    >
                                      + {t('createNewChore')}
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {choresOnThisDay.length === 0 ? (
                                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.01)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-light)' }}>
                                    <CalendarIcon size={24} style={{ marginBottom: '8px', color: 'var(--text-secondary)', opacity: 0.4 }} />
                                    <p style={{ fontSize: '13px', fontWeight: '500', margin: 0 }}>{t('noChoresForDate')}</p>
                                  </div>
                                ) : (
                                  choresOnThisDay.map(chore => {
                                    const completed = isChoreCompletedOnDate(chore, cellDateStr);
                                    const isMed = !!chore.is_medication;

                                    return (
                                      <div
                                        key={chore.id}
                                        onClick={() => handleEditChoreClick(chore)}
                                        className="glass-panel-hover"
                                        style={{
                                          padding: '12px',
                                          borderRadius: 'var(--radius-md)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '12px',
                                          cursor: 'pointer',
                                          borderLeft: '4px solid',
                                          borderLeftColor: completed ? 'var(--accent-success)' : isMed ? 'var(--accent-info)' : 'var(--accent-primary)',
                                          background: completed ? 'rgba(16, 185, 129, 0.03)' : 'rgba(255,255,255,0.01)'
                                        }}
                                      >
                                        {/* Horário ou ícone */}
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '60px', paddingRight: '8px', borderRight: '1px solid var(--border-light)' }}>
                                          {chore.fixed_time ? (
                                            <>
                                              <Clock size={12} style={{ color: isMed ? 'var(--accent-info)' : 'var(--accent-primary)', marginBottom: '2px' }} />
                                              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-primary)' }}>{chore.fixed_time}</span>
                                            </>
                                          ) : (
                                            <>
                                              <CalendarIcon size={12} style={{ color: 'var(--text-secondary)', marginBottom: '2px' }} />
                                              <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)' }}>{t('flexible')}</span>
                                            </>
                                          )}
                                        </div>

                                        {/* Corpo do card */}
                                        <div style={{ flex: 1 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                            <h4 style={{ fontSize: '13px', fontWeight: '700', color: completed ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: completed ? 'line-through' : 'none', margin: 0 }}>
                                              {chore.title}
                                            </h4>
                                            <span style={{ fontSize: '8px', background: isMed ? 'rgba(6, 182, 212, 0.12)' : 'rgba(139, 92, 246, 0.12)', color: isMed ? 'var(--accent-info)' : 'var(--accent-primary-hover)', padding: '1px 5px', borderRadius: '10px', fontWeight: 'bold' }}>
                                              {isMed ? t('medication') : t('routine')}
                                            </span>
                                          </div>
                                          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 4px 0', lineBreak: 'anywhere' }}>
                                            {chore.description || t('noDescription')}
                                          </p>
                                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600' }}>
                                              👤 {chore.assigned_to === 'all' ? t('allFamily') : chore.assigned_to}
                                            </span>
                                            {gamificationEnabled && (
                                              <span className="badge-xp" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-success)', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '9px', padding: '0 4px' }}>
                                                ★ {chore.points_worth} XP
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        {/* Botão de Conclusão */}
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            await handleCompleteChore(chore.id, cellDateStr);
                                            showToast(`${completed ? t('reopened') : t('completed')}: "${chore.title}"!`, completed ? 'info' : 'success');
                                          }}
                                          className={completed ? 'btn-secondary' : 'btn-primary'}
                                          style={{ padding: '6px 10px', fontSize: '10px', background: completed ? 'rgba(16, 185, 129, 0.15)' : 'var(--accent-primary)', borderColor: completed ? 'var(--accent-success)' : 'transparent', color: completed ? 'var(--accent-success)' : '#fff', fontWeight: '700' }}
                                        >
                                          {completed ? t('doneCheck') : t('doAction')}
                                        </button>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          );
                        })()}

                      </div>
                    );
                  })()}
                  </div>
                );
              })()}


              {/* ABA 4: LISTA DE COMPRAS */}
              {activeTab === 'shopping' && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
                  
                  {/* Google Keep style quick-add bar */}
                  <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
                    <form onSubmit={handleKeepAddShoppingItem} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(236, 72, 153, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ShoppingBag size={20} style={{ color: '#ec4899' }} />
                      </div>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <input
                          type="text"
                          className="input-field"
                          placeholder={isAddingShoppingItem ? t('shoppingInputClassifying') : t('shoppingInputPlaceholder')}
                          value={keepItemName}
                          disabled={isAddingShoppingItem}
                          onChange={(e) => {
                            setKeepItemName(e.target.value);
                            setShowSuggestions(true);
                          }}
                          onFocus={() => setShowSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowSuggestions(false), 250)}
                          style={{
                            margin: 0,
                            border: 'none',
                            background: 'transparent',
                            fontSize: '15px',
                            fontWeight: '600',
                            padding: '10px 0',
                            boxShadow: 'none',
                            color: isAddingShoppingItem ? 'var(--text-muted)' : 'var(--text-primary)',
                            width: '100%'
                          }}
                          autoComplete="off"
                        />
                        
                        {/* Auto-complete suggestions */}
                        {!isAddingShoppingItem && showSuggestions && shoppingSuggestions.length > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              zIndex: 20,
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-medium)',
                              borderRadius: 'var(--radius-sm)',
                              boxShadow: 'var(--shadow-lg)',
                              marginTop: '8px',
                              maxHeight: '180px',
                              overflowY: 'auto'
                            }}
                          >
                            {shoppingSuggestions.map(suggest => (
                              <div
                                key={suggest.id}
                                onClick={() => handleQuickAddSuggestion(suggest)}
                                style={{
                                  padding: '10px 14px',
                                  fontSize: '13px',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid var(--border-light)',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center'
                                }}
                                className="glass-panel-hover"
                              >
                                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{suggest.name}</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                  {suggest.quantity} • {suggest.category}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <button 
                        type="submit" 
                        disabled={!keepItemName.trim() || isAddingShoppingItem}
                        className="btn-primary" 
                        style={{
                          background: keepItemName.trim() && !isAddingShoppingItem ? 'linear-gradient(135deg, #ec4899, #db2777)' : 'rgba(255, 255, 255, 0.05)',
                          border: 'none',
                          color: keepItemName.trim() && !isAddingShoppingItem ? 'white' : 'var(--text-muted)',
                          boxShadow: keepItemName.trim() && !isAddingShoppingItem ? '0 4px 12px rgba(236, 72, 153, 0.2)' : 'none',
                          padding: '10px 18px',
                          fontSize: '13px',
                          fontWeight: '600',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: keepItemName.trim() && !isAddingShoppingItem ? 'pointer' : 'not-allowed',
                          transition: 'all 0.2s'
                        }}
                      >
                        {isAddingShoppingItem ? (
                          <>
                            <RefreshCw size={16} className="animate-spin" /> {t('classifyingAi')}
                          </>
                        ) : (
                          <>
                            <Plus size={16} /> {t('add')}
                          </>
                        )}
                      </button>
                    </form>
                  </div>

                  {/* Painel de Sugestões Inteligentes de Compras (Predições Baseadas em Histórico) */}
                  {smartSuggestions.length > 0 && (
                    <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {t('smartRecommendationsTitle')}
                          </span>
                        </div>
                        <button
                          onClick={generateSmartPurchaseSuggestions}
                          disabled={isGeneratingSuggestions}
                          className="glass-panel-hover"
                          style={{
                            border: 'none',
                            background: 'rgba(255,255,255,0.04)',
                            color: 'var(--text-secondary)',
                            padding: '6px 12px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s'
                          }}
                        >
                          <RefreshCw size={12} className={isGeneratingSuggestions ? "animate-spin" : ""} />
                          {t('recalculate')}
                        </button>
                      </div>

                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                        {t('smartRecommendationsDesc')}
                      </p>

                      {isGeneratingSuggestions ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                          <RefreshCw size={16} className="animate-spin" style={{ color: '#ec4899' }} />
                          {t('generatingRecommendations')}
                        </div>
                      ) : (
                        <div className="suggestion-carousel">
                          {smartSuggestions.map((suggest, idx) => (
                            <div key={idx} className="suggestion-card">
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {suggest.name}
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--accent-warning)', fontWeight: '600' }}>
                                  {suggest.quantity || '1 un'}
                                </span>
                              </div>
                              
                              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', minHeight: '32px', display: 'flex', alignItems: 'center', lineHeight: '1.3' }}>
                                {suggest.reason}
                              </span>

                              <button
                                onClick={() => handleQuickAddSuggestion({
                                  name: suggest.name,
                                  quantity: suggest.quantity || '1 un',
                                  category: suggest.category || 'Alimentos'
                                })}
                                className="btn-suggestion-add"
                              >
                                {t('addToList')}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Exibição dos Itens da Lista de Compras */}
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <ShoppingBag size={20} style={{ color: 'var(--accent-warning)' }} /> {t('sharedShoppingList')}
                    </h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      {['Alimentos', 'Higiene', 'Limpeza', 'Farmácia', 'Pet', 'Bebê', 'Casa & Utensílios', 'Outros', 'Sem categoria'].map(category => {
                        const itemsInCat = activeShoppingItems.filter(item => item.category === category);
                        
                        // Se não estamos arrastando nenhum item e a categoria está vazia, oculta (visual limpo)
                        if (draggingItemId === null && itemsInCat.length === 0) return null;

                        // Se estamos arrastando e a categoria está vazia, exibe um belíssimo drop zone placeholder
                        if (draggingItemId !== null && itemsInCat.length === 0) {
                          const isHovered = dragOverCategory === category;
                          return (
                            <div
                              key={category}
                              onDragOver={handleDragOver}
                              onDragEnter={(e) => { e.preventDefault(); setDragOverCategory(category); }}
                              onDragLeave={() => setDragOverCategory(null)}
                              onDrop={(e) => handleDrop(e, category)}
                              className="animate-pulse"
                              style={{
                                border: isHovered ? '2px dashed var(--accent-warning)' : '2px dashed var(--border-light)',
                                background: isHovered ? 'rgba(255, 193, 7, 0.05)' : 'rgba(255, 255, 255, 0.01)',
                                borderRadius: 'var(--radius-md)',
                                padding: '20px',
                                textAlign: 'center',
                                transition: 'all 0.2s ease',
                                cursor: 'copy',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  background: category === 'Alimentos' ? '#10b981' :
                                              category === 'Higiene' ? '#8b5cf6' :
                                              category === 'Limpeza' ? '#3b82f6' :
                                              category === 'Farmácia' ? '#ef4444' :
                                              category === 'Pet' ? '#f59e0b' :
                                              category === 'Bebê' ? '#ec4899' :
                                              category === 'Casa & Utensílios' ? '#14b8a6' :
                                              category === 'Sem categoria' ? '#9ca3af' : '#6b7280'
                                }} />
                                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>{t(getCategoryTranslationKey(category))}</span>
                              </div>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('dropToCategorize')}</span>
                            </div>
                          );
                        }

                        // Se a categoria tem itens (ou se está sendo arrastado e tem itens)
                        const isHoveredGroup = dragOverCategory === category;
                        return (
                          <div
                            key={category}
                            className="animate-slide-up"
                            onDragOver={handleDragOver}
                            onDragEnter={(e) => { e.preventDefault(); if (draggingItemId) { setDragOverCategory(category); } }}
                            onDragLeave={() => setDragOverCategory(null)}
                            onDrop={(e) => handleDrop(e, category)}
                            style={{
                              transition: 'all 0.3s',
                              borderRadius: 'var(--radius-md)',
                              padding: isHoveredGroup ? '12px' : '0px',
                              background: isHoveredGroup ? 'rgba(255, 193, 7, 0.03)' : 'transparent',
                              border: isHoveredGroup ? '1.5px dashed var(--accent-warning)' : '1.5px dashed transparent',
                            }}
                          >
                            <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--accent-warning)', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: category === 'Alimentos' ? '#10b981' :
                                            category === 'Higiene' ? '#8b5cf6' :
                                            category === 'Limpeza' ? '#3b82f6' :
                                            category === 'Farmácia' ? '#ef4444' :
                                            category === 'Pet' ? '#f59e0b' :
                                            category === 'Bebê' ? '#ec4899' :
                                            category === 'Casa & Utensílios' ? '#14b8a6' :
                                            category === 'Sem categoria' ? '#9ca3af' : '#6b7280'
                              }} />
                              {t(getCategoryTranslationKey(category))}
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'normal', marginLeft: 'auto' }}>
                                {itemsInCat.length} {itemsInCat.length === 1 ? t('item') : t('items')}
                              </span>
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {itemsInCat.map(item => {
                                const checked = item.checked === 1;
                                const isClassifying = itemsBeingClassified.has(item.id);
                                return (
                                  <div
                                    key={item.id}
                                    draggable={!isClassifying && !checked}
                                    onDragStart={(e) => handleDragStart(e, item.id)}
                                    onDragEnd={handleDragEnd}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '12px',
                                      padding: '8px 4px',
                                      borderBottom: '1px solid var(--border-light)',
                                      background: 'transparent',
                                      opacity: checked ? 0.5 : draggingItemId === item.id ? 0.4 : 1,
                                      transition: 'all 0.2s',
                                      cursor: isClassifying ? 'not-allowed' : checked ? 'default' : draggingItemId === item.id ? 'grabbing' : 'grab'
                                    }}
                                    onMouseEnter={(e) => { if (!checked && draggingItemId !== item.id) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                  >
                                    <div
                                      onClick={() => !isClassifying && handleToggleShoppingItem(item.id)}
                                      style={{
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '4px',
                                        border: '2px solid',
                                        borderColor: checked ? 'var(--accent-warning)' : 'var(--text-muted)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: checked ? 'var(--accent-warning)' : 'transparent',
                                        color: '#000',
                                        cursor: isClassifying ? 'not-allowed' : 'pointer'
                                      }}
                                    >
                                      {checked && <Check size={12} strokeWidth={3} />}
                                    </div>
                                    <div style={{ flex: 1, cursor: isClassifying ? 'default' : 'pointer' }} onClick={() => !isClassifying && handleToggleShoppingItem(item.id)}>
                                      <p style={{ fontSize: '14px', fontWeight: '600', textDecoration: checked ? 'line-through' : 'none', margin: 0, color: 'var(--text-primary)' }}>
                                        {item.name}
                                      </p>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                          {t('addedBy')}: {item.added_by} {checked && item.checked_by && `| ${t('boughtByLabel')}: ${item.checked_by}`}
                                        </span>
                                        {isClassifying && (
                                          <span className="shimmer" style={{
                                            fontSize: '10px',
                                            fontWeight: '700',
                                            color: '#ec4899',
                                            background: 'rgba(236, 72, 153, 0.1)',
                                            padding: '2px 8px',
                                            borderRadius: '10px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                          }}>
                                            <Wand2 size={10} className="animate-pulse" /> {t('classifyingAi')}
                                          </span>
                                        )}
                                        {!isClassifying && item.ai_status === 'pending' && (
                                          <span style={{
                                            fontSize: '10px',
                                            fontWeight: '700',
                                            color: '#9ca3af',
                                            background: 'rgba(156, 163, 175, 0.1)',
                                            padding: '2px 8px',
                                            borderRadius: '10px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                          }}>
                                            {t('aiPending')}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Quantidade em Destaque Alinhada à Direita */}
                                    <div style={{
                                      fontSize: '14px',
                                      fontWeight: '700',
                                      color: checked ? 'var(--text-muted)' : 'var(--accent-warning)',
                                      background: checked ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 193, 7, 0.08)',
                                      border: checked ? '1px solid var(--border-light)' : '1px solid rgba(255, 193, 7, 0.18)',
                                      borderRadius: '6px',
                                      padding: '4px 10px',
                                      minWidth: '45px',
                                      textAlign: 'center',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      userSelect: 'none',
                                      whiteSpace: 'nowrap',
                                      transition: 'all 0.2s ease',
                                    }}>
                                      {item.quantity}
                                    </div>

                                    {/* Ajustadores de Quantidade (Volume-style) */}
                                    {!checked && !isClassifying && (
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', marginRight: '8px' }}>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleAdjustShoppingItemQty(item.id, 1);
                                          }}
                                          style={{ border: 'none', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                          title={t('increaseQty')}
                                        >
                                          <ChevronUp size={14} />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleAdjustShoppingItemQty(item.id, -1);
                                          }}
                                          style={{ border: 'none', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                          title={t('decreaseQty')}
                                        >
                                          <ChevronDown size={14} />
                                        </button>
                                      </div>
                                    )}

                                    {checked ? (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleArchiveShoppingItem(item.id);
                                        }}
                                        style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                        title={t('archiveItem')}
                                      >
                                        <Archive size={13} />
                                      </button>
                                    ) : (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteShoppingItem(item.id);
                                        }}
                                        style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                        title={t('deleteItem')}
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      
                      {activeShoppingItems.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '24px' }}>🛒</span>
                          <p style={{ margin: 0, fontSize: '14px' }}>{t('emptyShoppingList')}</p>
                        </div>
                      )}

                      {/* Seção Colapsável de Arquivados */}
                      {archivedShoppingItems.length > 0 && (
                        <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
                          <button
                            onClick={() => setShowArchivedShopping(!showArchivedShopping)}
                            className="btn-secondary"
                            style={{
                              width: '100%',
                              justifyContent: 'space-between',
                              padding: '12px 16px',
                              borderRadius: 'var(--radius-md)',
                              background: 'rgba(255,255,255,0.02)',
                              fontSize: '14px',
                              fontWeight: '600'
                            }}
                          >
                            <span>📦 {t('shoppingHistoryArchived')} ({archivedShoppingItems.length})</span>
                            <span>{showArchivedShopping ? t('collapse') : t('expand')}</span>
                          </button>

                          {showArchivedShopping && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }} className="animate-slide-up">
                              {archivedShoppingItems.map(item => (
                                <div
                                  key={item.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '10px 14px',
                                    borderRadius: 'var(--radius-sm)',
                                    background: 'rgba(255,255,255,0.01)',
                                    border: '1px solid var(--border-light)',
                                    opacity: 0.7
                                  }}
                                >
                                  <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: '13px', fontWeight: '600', textDecoration: 'line-through', color: 'var(--text-muted)', margin: 0 }}>
                                      {item.name}
                                    </p>
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                      {t('qtyLabel')}: {item.quantity} | {t('boughtBy').replace('{user}', item.checked_by || t('someone')).replace('{date}', new Date(item.updated_at).toLocaleDateString(LOCALE_MAP[language] || 'en-US'))}
                                    </span>
                                  </div>
                                  
                                  {/* Botão Restaurar */}
                                  <button
                                    onClick={() => handleRestoreShoppingItem(item.id)}
                                    style={{ border: 'none', background: 'none', color: 'var(--accent-primary-hover)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                    title={t('restoreItemTooltip')}
                                  >
                                    <RotateCcw size={14} />
                                  </button>

                                  <button onClick={() => handleDeleteShoppingItem(item.id)} style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} title={t('deletePermanently')}>
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  </div>

                </div>
              )}

              {/* ABA 6: GAMIFICAÇÃO */}
              {gamificationEnabled && activeTab === 'gamification' && (
                <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                  
                  {/* Leaderboard Completo */}
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Trophy size={18} style={{ color: 'var(--accent-warning)' }} />
                      <span>{t('leaderboardTitle')}</span>
                    </h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {Object.entries(userStats)
                        .sort((a, b) => b[1].points - a[1].points)
                        .map(([name, stats], idx) => {
                          const levelPercent = Math.round((stats.points % 150) / 150 * 100);
                          return (
                            <div key={name} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span style={{ fontSize: '18px', fontWeight: '800', color: idx === 0 ? 'var(--accent-warning)' : idx === 1 ? '#d1d5db' : '#b45309' }}>
                                    #{idx + 1}
                                  </span>
                                  <span style={{ fontWeight: '600', fontSize: '15px' }}>{stats.displayName || name}</span>
                                </div>
                                <span className="badge-xp">{stats.points} {t('totalXpLabel')}</span>
                              </div>

                              {/* Progress bar de nível */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                <span>{t('levelLabel').replace('{level}', String(stats.level))}</span>
                                <span>{stats.points % 150} / 150 XP</span>
                              </div>
                              <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${levelPercent}%`, background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-success))' }}></div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Loja de Recompensas */}
                  <div className="reward-store-panel glass-panel" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                      <div>
                        <h3 style={{ fontSize: '18px', fontWeight: '700' }}>{t('rewardStoreTitle')}</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{t('gamificationSubtitle')}</p>
                      </div>

                      {/* Exibir pontos do usuário atual */}
                      <div className="glass-panel" style={{ padding: '8px 16px', border: '1px solid var(--border-focus)', display: 'flex', alignItems: 'center', gap: '8px', height: 'fit-content' }}>
                        <Coins size={16} style={{ color: 'var(--accent-warning)' }} />
                        <span style={{ fontSize: '13px', fontWeight: '700' }}>
                          {t('yourBalance').replace('{points}', String(localPoints
                              .filter(p => p.user_id === (currentUser ? currentUser.id : 'demo-user-child'))
                              .reduce((acc, p) => acc + p.points, 0)))}
                        </span>
                      </div>
                    </div>

                    {/* Adicionar Recompensa */}
                    {(!currentUser || currentUser.role === 'admin' || !isAuthenticated) && (
                      <form onSubmit={handleCreateReward} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', padding: '16px', borderRadius: 'var(--radius-md)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ gridColumn: 'span 2' }}>
                          <input type="text" className="input-field" style={{ padding: '8px 12px', fontSize: '13px' }} placeholder={t('rewardNamePlaceholder')} value={newRewardTitle} onChange={(e) => setNewRewardTitle(e.target.value)} required />
                        </div>
                        <div>
                          <input type="text" className="input-field" style={{ padding: '8px 12px', fontSize: '13px' }} placeholder={t('rewardDescriptionPlaceholder')} value={newRewardDesc} onChange={(e) => setNewRewardDesc(e.target.value)} />
                        </div>
                        <div>
                          <input type="number" className="input-field" style={{ padding: '8px 12px', fontSize: '13px' }} placeholder={t('rewardCostPlaceholder')} value={newRewardCost} onChange={(e) => setNewRewardCost(Number(e.target.value))} required />
                        </div>
                        <button type="submit" className="btn-primary" style={{ padding: '8px', fontSize: '12px' }}>{t('createReward')}</button>
                      </form>
                    )}

                    {/* Grid de Recompensas Ativas */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                      {localRewards.map(rew => (
                        <div key={rew.id} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                          <div>
                            <h4 style={{ fontSize: '15px', fontWeight: '700' }}>{rew.title}</h4>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>{rew.description}</p>
                          </div>
                          
                          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--accent-warning)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Coins size={14} /> {rew.cost_points} XP
                            </span>
                            <button
                              onClick={() => handleRedeemReward(rew.id)}
                              className="btn-primary"
                              style={{ padding: '6px 12px', fontSize: '11px', background: 'linear-gradient(135deg, var(--accent-success), #047857)' }}
                            >
                              {t('redeem')}
                            </button>
                          </div>
                        </div>
                      ))}
                      {localRewards.length === 0 && (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                          {t('noRewardsYet')}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}

              {/* ABA 7: RELATÓRIOS E CONQUISTAS (v1.2.0) */}
              {activeTab === 'reports' && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  
                  {/* Cabeçalho */}
                  <div className="glass-panel" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: 'linear-gradient(135deg, var(--accent-primary), #4c1d95)', padding: '12px', borderRadius: 'var(--radius-md)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(124, 58, 237, 0.25)' }}>
                        <BarChart3 size={24} />
                      </div>
                      <div>
                        <h2 style={{ fontSize: '22px', fontWeight: '800', background: 'linear-gradient(135deg, #ffffff 0%, #a78bfa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
                          {t('reportsTab')}
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px', margin: 0 }}>
                          {t('reportsSubtitle')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Cards de Métricas */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                    
                    <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', position: 'relative', transition: 'all 0.3s ease', cursor: 'default' }}>
                      <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '12px', borderRadius: 'var(--radius-md)', color: 'var(--accent-success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckSquare size={24} />
                      </div>
                      <div>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                          {t('reportsTotalChores')}
                        </p>
                        <h3 style={{ fontSize: '24px', fontWeight: '800', marginTop: '4px', color: '#ffffff', margin: 0 }}>
                          {reportsStats.tasksCount}
                        </h3>
                      </div>
                    </div>

                    <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', position: 'relative', transition: 'all 0.3s ease', cursor: 'default' }}>
                      <div style={{ background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.2)', padding: '12px', borderRadius: 'var(--radius-md)', color: 'var(--accent-info)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Clock size={24} />
                      </div>
                      <div>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                          {t('reportsTotalMeds')}
                        </p>
                        <h3 style={{ fontSize: '24px', fontWeight: '800', marginTop: '4px', color: '#ffffff', margin: 0 }}>
                          {reportsStats.medsCount}
                        </h3>
                      </div>
                    </div>

                    <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', position: 'relative', transition: 'all 0.3s ease', cursor: 'default' }}>
                      <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '12px', borderRadius: 'var(--radius-md)', color: 'var(--accent-warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Award size={24} />
                      </div>
                      <div>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                          {t('reportsTotalRewards')}
                        </p>
                        <h3 style={{ fontSize: '24px', fontWeight: '800', marginTop: '4px', color: '#ffffff', margin: 0 }}>
                          {reportsStats.rewardsCount}
                        </h3>
                      </div>
                    </div>

                    <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', position: 'relative', transition: 'all 0.3s ease', cursor: 'default' }}>
                      <div style={{ background: 'rgba(124, 58, 237, 0.1)', border: '1px solid rgba(124, 58, 237, 0.2)', padding: '12px', borderRadius: 'var(--radius-md)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Sparkles size={24} />
                      </div>
                      <div>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                          {t('reportsTotalXp')}
                        </p>
                        <h3 style={{ fontSize: '24px', fontWeight: '800', marginTop: '4px', color: '#ffffff', margin: 0 }}>
                          {reportsStats.familyXp} XP
                        </h3>
                      </div>
                    </div>

                  </div>

                  {/* Gráficos de Contribuição e Tendência */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                    
                    {/* Gráfico Rosca */}
                    <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <Users size={18} style={{ color: 'var(--accent-primary)' }} />
                        <span>{t('reportsChartContribution')}</span>
                      </h3>
                      
                      {contributionSegments.length === 0 ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', minHeight: '200px' }}>
                          {t('reportsNoData')}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: '20px', flex: 1 }}>
                          
                          <div style={{ position: 'relative', width: '150px', height: '150px' }}>
                            <svg width="150" height="150" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                              <circle cx="60" cy="60" r="50" fill="transparent" stroke="rgba(255,255,255,0.03)" strokeWidth="12" />
                              {contributionSegments.map((seg) => (
                                <circle
                                  key={seg.name}
                                  cx="60"
                                  cy="60"
                                  r="50"
                                  fill="transparent"
                                  stroke={seg.color}
                                  strokeWidth="12"
                                  strokeDasharray={seg.strokeDasharray}
                                  strokeDashoffset={seg.strokeDashoffset}
                                  strokeLinecap="round"
                                  style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                                />
                              ))}
                            </svg>
                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', width: '80%' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', fontWeight: '600' }}>Total</span>
                              <span style={{ fontSize: '18px', fontWeight: '800', color: '#ffffff' }}>{reportsStats.familyXp}</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '140px' }}>
                            {contributionSegments.map(seg => (
                              <div key={seg.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: seg.color }} />
                                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{seg.name}</span>
                                </div>
                                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                                  {seg.percent}%
                                </span>
                              </div>
                            ))}
                          </div>

                        </div>
                      )}
                    </div>

                    {/* Gráfico de Barras dos últimos 7 dias */}
                    <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <Trophy size={18} style={{ color: 'var(--accent-success)' }} />
                        <span>{t('reportsChartTrend')}</span>
                      </h3>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, justifyContent: 'center' }}>
                        {weeklyTrendData.map((day) => (
                          <div key={day.label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ width: '70px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                              {day.label}
                            </span>
                            <div style={{ flex: 1, height: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: '7px', overflow: 'hidden', position: 'relative' }}>
                              <div 
                                style={{ 
                                  height: '100%', 
                                  width: `${day.percent}%`, 
                                  background: 'linear-gradient(90deg, var(--accent-success), #10b981)', 
                                  borderRadius: '7px',
                                  transition: 'width 0.8s ease'
                                }} 
                              />
                            </div>
                            <span style={{ width: '25px', fontSize: '12px', fontWeight: '700', textAlign: 'right', color: '#ffffff' }}>
                              {day.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* Campeões e Conquistas */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                    
                    <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', right: '-20px', bottom: '-20px', opacity: 0.05, color: '#f59e0b' }}>
                        <Trophy size={120} />
                      </div>
                      <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', boxShadow: '0 8px 20px rgba(245,158,11,0.2)' }}>
                        <Trophy size={28} style={{ margin: 'auto' }} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--accent-warning)', fontWeight: '700', margin: 0 }}>
                          {t('reportsTopEarner')}
                        </h4>
                        <h3 style={{ fontSize: '18px', fontWeight: '800', marginTop: '4px', color: '#ffffff', margin: 0 }}>
                          {reportsHighlights.topEarner === 'none' ? '---' : reportsHighlights.topEarner}
                        </h3>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', margin: 0 }}>
                          {reportsHighlights.topEarner === 'none' ? '' : `+${reportsHighlights.maxEarned} XP`}
                        </p>
                      </div>
                    </div>

                    <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', right: '-20px', bottom: '-20px', opacity: 0.05, color: '#a78bfa' }}>
                        <Award size={120} />
                      </div>
                      <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', boxShadow: '0 8px 20px rgba(124,58,237,0.2)' }}>
                        <Award size={28} style={{ margin: 'auto' }} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#a78bfa', fontWeight: '700', margin: 0 }}>
                          {t('reportsTopSpender')}
                        </h4>
                        <h3 style={{ fontSize: '18px', fontWeight: '800', marginTop: '4px', color: '#ffffff', margin: 0 }}>
                          {reportsHighlights.topSpender === 'none' ? '---' : reportsHighlights.topSpender}
                        </h3>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', margin: 0 }}>
                          {reportsHighlights.topSpender === 'none' ? '' : `${reportsHighlights.maxSpent} XP ${t('reportsTotalRewards').toLowerCase()}`}
                        </p>
                      </div>
                    </div>

                  </div>

                  {/* Tabela de Histórico (Ledger) */}
                  <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                      <div>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>{t('reportsHistory')}</h3>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end', minWidth: '280px' }}>
                        
                        <select 
                          className="input-field" 
                          style={{ padding: '8px 12px', fontSize: '13px', width: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                          value={reportsSelectedUser}
                          onChange={(e) => setReportsSelectedUser(e.target.value)}
                        >
                          <option value="all">{t('reportsAllMembers')}</option>
                          {familyMembers.map(member => (
                            <option key={member.id} value={member.username}>{member.display_name || member.username}</option>
                          ))}
                        </select>

                        <select 
                          className="input-field" 
                          style={{ padding: '8px 12px', fontSize: '13px', width: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                          value={reportsSelectedType}
                          onChange={(e) => setReportsSelectedType(e.target.value)}
                        >
                          <option value="all">{t('reportsFilterAll')}</option>
                          <option value="tasks">{t('reportsFilterTasks')}</option>
                          <option value="meds">{t('reportsFilterMeds')}</option>
                          <option value="rewards">{t('reportsFilterRewards')}</option>
                        </select>

                        <input 
                          type="text" 
                          className="input-field" 
                          style={{ padding: '8px 12px', fontSize: '13px', width: '200px', background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                          placeholder={t('reportsSearchPlaceholder')}
                          value={reportsSearch}
                          onChange={(e) => setReportsSearch(e.target.value)}
                        />

                      </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      {filteredPointLogs.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          {t('reportsNoData')}
                        </div>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)', fontSize: '13px' }}>
                              <th style={{ padding: '12px 16px', fontWeight: '600' }}>{t('member')}</th>
                              <th style={{ padding: '12px 16px', fontWeight: '600' }}>
                                {{
                                  pt: 'Atividade',
                                  en: 'Activity',
                                  es: 'Actividad',
                                  pl: 'Aktywność',
                                  de: 'Aktivität',
                                  fr: 'Activité',
                                  it: 'Attività'
                                }[language] || 'Activity'}
                              </th>
                              <th style={{ padding: '12px 16px', fontWeight: '600' }}>XP</th>
                              <th style={{ padding: '12px 16px', fontWeight: '600' }}>
                                {{
                                  pt: 'Data / Hora',
                                  en: 'Date / Time',
                                  es: 'Fecha / Hora',
                                  pl: 'Data / Czas',
                                  de: 'Datum / Uhrzeit',
                                  fr: 'Date / Heure',
                                  it: 'Data / Ora'
                                }[language] || 'Date / Time'}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredPointLogs.map((log) => {
                              const isPositive = log.points > 0;
                              return (
                                <tr 
                                  key={log.id} 
                                  style={{ 
                                    borderBottom: '1px solid rgba(255,255,255,0.02)', 
                                    fontSize: '14px',
                                    transition: 'background 0.2s ease'
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.01)' }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                                >
                                  <td style={{ padding: '12px 16px', fontWeight: '600', color: '#ffffff' }}>
                                    {log.user_name}
                                  </td>
                                  <td style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>
                                    {log.reason}
                                  </td>
                                  <td style={{ padding: '12px 16px', fontWeight: '700', color: isPositive ? 'var(--accent-success)' : 'var(--accent-warning)' }}>
                                    {isPositive ? `+${log.points}` : log.points} XP
                                  </td>
                                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                                    {new Date(log.timestamp).toLocaleString(language === 'pt' ? 'pt-BR' : language, {
                                      day: 'numeric',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>

                  </div>

                </div>
              )}

              {/* ABA 8: CONFIGURAÇÕES E PARÂMETROS DO CLIENTE */}
              {activeTab === 'settings' && (
                <div 
                  className="animate-fade-in glass-panel" 
                  style={{ 
                    padding: '24px', 
                    maxWidth: activeSettingsSection === 'menu' ? '800px' : '600px', 
                    margin: '0 auto', 
                    width: '100%',
                    transition: 'max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
                  {activeSettingsSection === 'menu' ? (
                    <div>
                      <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '6px', color: 'var(--text-primary)' }}>{t('appSettingsTitle')}</h3>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                        {t('appSettingsDesc')}
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                        {/* CARD 1: Meu Perfil */}
                        {currentUser && (
                          <div 
                            className="glass-panel glass-panel-hover" 
                            onClick={() => {
                              setProfileSaveSuccess('');
                              setProfileSaveError('');
                              setActiveSettingsSection('profile');
                            }}
                            style={{ padding: '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <User size={20} style={{ color: 'var(--accent-primary)' }} />
                              </div>
                              <h4 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>{t('myProfile')}</h4>
                            </div>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4', margin: 0 }}>
                              {t('myProfileDesc')}
                            </p>
                          </div>
                        )}

                        {/* CARD 2: Família & Integrantes */}
                        <div 
                          className="glass-panel glass-panel-hover" 
                          onClick={() => setActiveSettingsSection('family')}
                          style={{ padding: '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Users size={20} style={{ color: 'var(--accent-success)' }} />
                            </div>
                            <h4 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>{t('myFamily')}</h4>
                          </div>
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4', margin: 0 }}>
                            {currentUser?.role === 'admin' 
                              ? t('myFamilyDescAdmin')
                              : t('myFamilyDescUser')}
                          </p>
                        </div>

                        {/* CARD 3: Sistema & Banco de Dados (Admin Only) */}
                        {currentUser?.role === 'admin' && (
                          <div 
                            className="glass-panel glass-panel-hover" 
                            onClick={() => setActiveSettingsSection('server')}
                            style={{ padding: '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(6, 182, 212, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Database size={20} style={{ color: 'var(--accent-info)' }} />
                              </div>
                              <h4 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>{t('systemAndDatabase')}</h4>
                            </div>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4', margin: 0 }}>
                              {t('systemAndDatabaseDesc')}
                            </p>
                          </div>
                        )}



                        {/* CARD 6: Aparência & Preferências */}
                        <div 
                          className="glass-panel glass-panel-hover" 
                          onClick={() => setActiveSettingsSection('appearance')}
                          style={{ padding: '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Palette size={20} style={{ color: 'var(--accent-primary)' }} />
                            </div>
                            <h4 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>{t('languageAndAppearance')}</h4>
                          </div>
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4', margin: 0 }}>
                            {t('languageAndAppearanceDesc')}
                          </p>
                        </div>

                        {/* CARD 7: Inteligência Artificial (Gemini) */}
                        <div 
                          className="glass-panel glass-panel-hover" 
                          onClick={() => {
                            setAiConfigApiKey(geminiApiKey);
                            setAiConfigEnabled(aiCategorizationEnabled);
                            setAiConfigTestResult('');
                            setActiveSettingsSection('ai_config');
                          }}
                          style={{ padding: '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(236, 72, 153, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Wand2 size={20} style={{ color: '#ec4899' }} />
                            </div>
                            <h4 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>{t('aiSettings')}</h4>
                          </div>
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4', margin: 0 }}>
                            {t('aiSettingsDesc')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="animate-slide-up">
                      {/* Botão de Voltar */}
                      <div style={{ marginBottom: '20px' }}>
                        <button 
                          onClick={() => setActiveSettingsSection('menu')} 
                          className="btn-secondary" 
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', fontSize: '12px', borderRadius: 'var(--radius-sm)' }}
                        >
                          <ArrowLeft size={14} /> {t('backToSettings')}
                        </button>
                      </div>

                      {/* CONTEÚDOS DAS SUB-SEÇÕES */}
                      
                      {/* 0. TEMA E APARÊNCIA */}
                      {activeSettingsSection === 'appearance' && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Palette size={18} style={{ color: 'var(--accent-primary)' }} />
                            </div>
                            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>{t('themeAndAppearance')}</h3>
                          </div>

                          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>
                            {t('chooseThemeDesc')}
                          </p>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {[
                              { id: 'violet', label: t('themeVioletName'), desc: t('themeVioletDesc'), color: '#8b5cf6', grad: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' },
                              { id: 'emerald', label: t('themeEmeraldName'), desc: t('themeEmeraldDesc'), color: '#10b981', grad: 'linear-gradient(135deg, #10b981, #047857)' },
                              { id: 'cyan', label: t('themeCyanName'), desc: t('themeCyanDesc'), color: '#06b6d4', grad: 'linear-gradient(135deg, #06b6d4, #0891b2)' },
                              { id: 'amber', label: t('themeAmberName'), desc: t('themeAmberDesc'), color: '#f59e0b', grad: 'linear-gradient(135deg, #f59e0b, #b45309)' },
                              { id: 'ruby', label: t('themeRubyName'), desc: t('themeRubyDesc'), color: '#ef4444', grad: 'linear-gradient(135deg, #ef4444, #b91c1c)' }
                            ].map(themeOpt => {
                              const isSelected = accentTheme === themeOpt.id;
                              return (
                                <div
                                  key={themeOpt.id}
                                  onClick={() => handleChangeTheme(themeOpt.id)}
                                  style={{
                                    padding: '14px 18px',
                                    borderRadius: 'var(--radius-md)',
                                    background: isSelected ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.1)',
                                    border: '1px solid',
                                    borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-light)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '16px',
                                    transition: 'all var(--transition-fast)'
                                  }}
                                  className="glass-panel-hover"
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                    {/* Círculo de cor */}
                                    <div
                                      style={{
                                        width: '22px',
                                        height: '22px',
                                        borderRadius: '50%',
                                        background: themeOpt.grad,
                                        boxShadow: isSelected ? `0 0 10px ${themeOpt.color}` : 'none'
                                      }}
                                    />
                                    <div>
                                      <p style={{ fontSize: '14px', fontWeight: '600', color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', margin: 0 }}>
                                        {themeOpt.label} {isSelected && '✓'}
                                      </p>
                                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>{themeOpt.desc}</p>
                                    </div>
                                  </div>

                                  <div
                                    style={{
                                      width: '16px',
                                      height: '16px',
                                      borderRadius: '50%',
                                      border: '2px solid',
                                      borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-light)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      background: isSelected ? 'var(--accent-primary)' : 'transparent'
                                    }}
                                  >
                                    {isSelected && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'white' }} />}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div style={{ marginTop: '30px', borderTop: '1px solid var(--border-light)', paddingTop: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                              <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <CalendarIcon size={18} style={{ color: 'var(--accent-primary)' }} />
                              </div>
                              <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>{t('defaultCalendarView')}</h3>
                            </div>

                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>
                              {t('defaultCalendarViewDesc')}
                            </p>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                              {[
                                { id: 'month', label: t('calendarViewMonthLabel'), desc: t('calendarViewMonthDesc'), icon: '📅' },
                                { id: 'week', label: t('calendarViewWeekLabel'), desc: t('calendarViewWeekDesc'), icon: '🗓️' },
                                { id: 'day', label: t('calendarViewDayLabel'), desc: t('calendarViewDayDesc'), icon: '☀️' }
                              ].map(viewOpt => {
                                const isSelected = defaultCalendarView === viewOpt.id;
                                return (
                                  <div
                                    key={viewOpt.id}
                                    onClick={() => handleChangeDefaultCalendarView(viewOpt.id as 'month' | 'week' | 'day')}
                                    style={{
                                      padding: '14px 18px',
                                      borderRadius: 'var(--radius-md)',
                                      background: isSelected ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.1)',
                                      border: '1px solid',
                                      borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-light)',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '6px',
                                      transition: 'all var(--transition-fast)'
                                    }}
                                    className="glass-panel-hover"
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <span style={{ fontSize: '20px' }}>{viewOpt.icon}</span>
                                      <div
                                        style={{
                                          width: '16px',
                                          height: '16px',
                                          borderRadius: '50%',
                                          border: '2px solid',
                                          borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-light)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          background: isSelected ? 'var(--accent-primary)' : 'transparent'
                                        }}
                                      >
                                        {isSelected && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'white' }} />}
                                      </div>
                                    </div>
                                    <div style={{ marginTop: '6px' }}>
                                      <p style={{ fontSize: '13px', fontWeight: '700', color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', margin: 0 }}>
                                        {viewOpt.label}
                                      </p>
                                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>{viewOpt.desc}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* SELETOR DE IDIOMA DO SISTEMA */}
                          <div style={{ marginTop: '30px', borderTop: '1px solid var(--border-light)', paddingTop: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                              <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Globe size={18} style={{ color: 'var(--accent-primary)' }} />
                              </div>
                              <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>{t('languageAndAppearance')}</h3>
                            </div>

                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>
                              {t('languageAndAppearanceDesc')}
                            </p>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                              {[
                                { id: 'pt', label: t('portuguese'), flag: '🇧🇷' },
                                { id: 'en', label: t('english'), flag: '🇺🇸' },
                                { id: 'es', label: t('spanish'), flag: '🇪🇸' },
                                { id: 'pl', label: t('polish'), flag: '🇵🇱' },
                                { id: 'de', label: t('german'), flag: '🇩🇪' },
                                { id: 'fr', label: t('french'), flag: '🇫🇷' },
                                { id: 'it', label: t('italian'), flag: '🇮🇹' }
                              ].map(langOpt => {
                                const isSelected = language === langOpt.id;
                                return (
                                  <div
                                    key={langOpt.id}
                                    onClick={async () => {
                                      setLanguage(langOpt.id);
                                      await db.metadata.put({ key: 'language', value: langOpt.id });
                                    }}
                                    style={{
                                      padding: '14px 18px',
                                      borderRadius: 'var(--radius-md)',
                                      background: isSelected ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.1)',
                                      border: '1px solid',
                                      borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-light)',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: '12px',
                                      transition: 'all var(--transition-fast)'
                                    }}
                                    className="glass-panel-hover"
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <span style={{ fontSize: '20px' }}>{langOpt.flag}</span>
                                      <p style={{ fontSize: '13px', fontWeight: '700', color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', margin: 0 }}>
                                        {langOpt.label}
                                      </p>
                                    </div>
                                    <div
                                      style={{
                                        width: '16px',
                                        height: '16px',
                                        borderRadius: '50%',
                                        border: '2px solid',
                                        borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-light)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: isSelected ? 'var(--accent-primary)' : 'transparent'
                                      }}
                                    >
                                      {isSelected && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'white' }} />}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* RECURSOS DE GAMIFICAÇÃO */}
                          <div style={{ marginTop: '30px', borderTop: '1px solid var(--border-light)', paddingTop: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                              <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Trophy size={18} style={{ color: 'var(--accent-primary)' }} />
                              </div>
                              <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>{t('gamificationFeatures')}</h3>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderRadius: 'var(--radius-md)', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)' }}>
                              <div style={{ marginRight: '16px', flex: 1 }}>
                                <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>{t('gamificationFeatures')}</p>
                                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, marginTop: '2px' }}>{t('gamificationFeaturesDesc')}</p>
                              </div>
                              <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '46px', height: '22px', cursor: 'pointer' }}>
                                <input 
                                  type="checkbox" 
                                  checked={gamificationEnabled} 
                                  onChange={async (e) => {
                                    const val = e.target.checked;
                                    setGamificationEnabled(val);
                                    await db.metadata.put({ key: 'gamification_enabled', value: val });
                                    if (!val && (activeTab as string) === 'gamification') {
                                      setActiveTab('dashboard');
                                    }
                                  }}
                                  style={{ opacity: 0, width: 0, height: 0 }}
                                />
                                <span style={{
                                  position: 'absolute',
                                  cursor: 'pointer',
                                  top: 0, left: 0, right: 0, bottom: 0,
                                  backgroundColor: gamificationEnabled ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.1)',
                                  transition: '0.3s',
                                  borderRadius: '34px'
                                }}>
                                  <span style={{
                                    position: 'absolute',
                                    content: '""',
                                    height: '16px', width: '16px',
                                    left: gamificationEnabled ? '26px' : '3px',
                                    bottom: '3px',
                                    backgroundColor: 'white',
                                    transition: '0.3s',
                                    borderRadius: '50%',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                  }} />
                                </span>
                              </label>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 0.5. INTELIGÊNCIA ARTIFICIAL (GEMINI AI) */}
                      {activeSettingsSection === 'ai_config' && (
                        <div className="animate-slide-up">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(236, 72, 153, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Wand2 size={18} style={{ color: '#ec4899' }} />
                            </div>
                            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>{t('aiSettings')} (Gemini)</h3>
                          </div>

                          {currentUser?.role !== 'admin' && (
                            <div style={{
                              padding: '16px',
                              borderRadius: 'var(--radius-md)',
                              background: 'rgba(236, 72, 153, 0.08)',
                              border: '1px solid rgba(236, 72, 153, 0.3)',
                              color: 'var(--text-primary)',
                              fontSize: '13px',
                              lineHeight: '1.5',
                              marginBottom: '20px',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '12px'
                            }}>
                              <Wand2 size={18} style={{ color: '#ec4899', flexShrink: 0, marginTop: '2px' }} />
                              <div>
                                <strong style={{ display: 'block', marginBottom: '4px', color: '#ec4899' }}>{t('centralizedAiTitle')}</strong>
                                {t('centralizedAiDesc')}
                              </div>
                            </div>
                          )}

                          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>
                            {t('aiCategorizationDesc')}
                          </p>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Ativar/Desativar Categorização por IA */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderRadius: 'var(--radius-md)', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)' }}>
                              <div>
                                <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>{t('aiCategorizationActive')}</p>
                                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, marginTop: '2px' }}>{t('geminiWarningDesc')}</p>
                              </div>
                              <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '46px', height: '22px', cursor: currentUser?.role === 'admin' ? 'pointer' : 'not-allowed' }}>
                                <input 
                                  type="checkbox" 
                                  checked={aiConfigEnabled} 
                                  onChange={(e) => setAiConfigEnabled(e.target.checked)}
                                  disabled={currentUser?.role !== 'admin'}
                                  style={{ opacity: 0, width: 0, height: 0 }}
                                />
                                <span style={{
                                  position: 'absolute',
                                  cursor: currentUser?.role === 'admin' ? 'pointer' : 'not-allowed',
                                  top: 0, left: 0, right: 0, bottom: 0,
                                  backgroundColor: aiConfigEnabled ? '#ec4899' : 'rgba(255, 255, 255, 0.1)',
                                  transition: '0.3s',
                                  borderRadius: '34px',
                                  opacity: currentUser?.role === 'admin' ? 1 : 0.6
                                }}>
                                  <span style={{
                                    position: 'absolute',
                                    content: '""',
                                    height: '16px', width: '16px',
                                    left: aiConfigEnabled ? '26px' : '3px',
                                    bottom: '3px',
                                    backgroundColor: 'white',
                                    transition: '0.3s',
                                    borderRadius: '50%',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                  }} />
                                </span>
                              </label>
                            </div>

                            {/* Chave da API do Gemini */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{t('geminiApiKeyLabel')}</label>
                              <div style={{ display: 'flex', gap: '8px', position: 'relative', width: '100%' }}>
                                <input
                                  type={showApiKey ? 'text' : 'password'}
                                  className="input-field"
                                  value={aiConfigApiKey}
                                  onChange={(e) => setAiConfigApiKey(e.target.value)}
                                  disabled={currentUser?.role !== 'admin'}
                                  placeholder={currentUser?.role === 'admin' ? t('aiApiKeyPlaceholderAdmin') : t('aiApiKeyPlaceholderUser')}
                                  style={{ paddingRight: '45px', width: '100%', opacity: currentUser?.role === 'admin' ? 1 : 0.7 }}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowApiKey(!showApiKey)}
                                  style={{
                                    position: 'absolute',
                                    right: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '5px'
                                  }}
                                >
                                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                              </div>
                              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
                                {t('geminiApiKeyDescPart1')} <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#ec4899', textDecoration: 'underline' }}>Google AI Studio</a>.
                              </p>
                            </div>

                            {/* Botões de Ação */}
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '5px' }}>
                              {currentUser?.role === 'admin' && (
                                <button
                                  onClick={() => handleSaveGeminiConfig(aiConfigApiKey, aiConfigEnabled)}
                                  className="btn-primary"
                                  style={{
                                    background: 'linear-gradient(135deg, #ec4899, #db2777)',
                                    border: 'none',
                                    boxShadow: '0 4px 12px rgba(236, 72, 153, 0.2)',
                                    padding: '10px 24px',
                                    fontSize: '13px',
                                    borderRadius: 'var(--radius-sm)'
                                  }}
                                >
                                  {t('saveAiSettings')}
                                </button>
                              )}

                              <button
                                onClick={handleClearAiCache}
                                className="btn-secondary"
                                style={{
                                  borderColor: 'rgba(236, 72, 153, 0.4)',
                                  color: 'var(--text-primary)',
                                  padding: '10px 24px',
                                  fontSize: '13px',
                                  borderRadius: 'var(--radius-sm)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '8px'
                                }}
                              >
                                <Trash2 size={14} style={{ color: '#ec4899' }} /> {t('clearAiCache')}
                              </button>
                            </div>

                            {/* Widget de Teste Interativo */}
                            <div style={{ marginTop: '20px', padding: '18px', borderRadius: 'var(--radius-md)', background: 'rgba(236, 72, 153, 0.02)', border: '1px dashed rgba(236, 72, 153, 0.3)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Wand2 size={16} style={{ color: '#ec4899' }} /> {t('testClassification')}
                              </h4>
                              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
                                {t('testClassificationDesc')}
                              </p>
                              
                              <div style={{ display: 'flex', gap: '10px' }}>
                                <input
                                  type="text"
                                  className="input-field"
                                  value={aiConfigTestItem}
                                  onChange={(e) => setAiConfigTestItem(e.target.value)}
                                  placeholder={t('testClassificationPlaceholder')}
                                  style={{ flex: 1, fontSize: '13px' }}
                                />
                            <button
                                  disabled={aiConfigTestLoading || !aiConfigTestItem.trim()}
                                  onClick={async () => {
                                    if (!aiConfigTestItem.trim()) return;
                                    setAiConfigTestLoading(true);
                                    setAiConfigTestResult('');
                                    try {
                                      const normalizeText = (str: string): string => {
                                        return str
                                          .normalize("NFD")
                                          .replace(/[\u0300-\u036f]/g, "")
                                          .toLowerCase()
                                          .trim();
                                      };
                                      const nameNormalized = normalizeText(aiConfigTestItem);
                                      const cacheEntry = await db.metadata.get('shop_cache:' + nameNormalized);

                                      let category = '';
                                      let corrected = '';
                                      let unit = '';

                                      if (cacheEntry && cacheEntry.value) {
                                        category = cacheEntry.value.category;
                                        corrected = cacheEntry.value.correctedName + " (Retornado do cache local)";
                                        unit = cacheEntry.value.defaultUnit || "un (Padrão)";
                                      } else if (aiConfigEnabled && aiConfigApiKey.trim()) {
                                        const res = await fetchRefinedItemFromGemini(aiConfigTestItem, aiConfigApiKey);
                                        category = res.category;
                                        corrected = res.correctedName + " (Retornado da IA em tempo real)";
                                        unit = res.defaultUnit || "un";
                                        
                                        // Gravar no cache local para adições futuras
                                        await db.metadata.put({
                                          key: 'shop_cache:' + nameNormalized,
                                          value: { category: res.category, correctedName: res.correctedName, defaultUnit: res.defaultUnit }
                                        });
                                      } else {
                                        category = 'Sem categoria';
                                        corrected = aiConfigTestItem + " (Sem IA ativa/chave configurada - Fallback padrão)";
                                        unit = "un";
                                      }
                                      setAiConfigTestResult(JSON.stringify({ category, corrected, unit }));
                                    } catch (err: any) {
                                      console.error('Erro no widget de testes de IA:', err);
                                      setAiConfigTestResult(JSON.stringify({ 
                                        category: 'Sem categoria', 
                                        corrected: aiConfigTestItem + " (Erro na chamada da IA - Fallback padrão)", 
                                        unit: 'un',
                                        error: err.message || 'Erro na API' 
                                      }));
                                    } finally {
                                      setAiConfigTestLoading(false);
                                    }
                                  }}
                                  className="btn-secondary"
                                  style={{ padding: '8px 16px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                  {aiConfigTestLoading ? t('classifying') : t('classify')}
                                </button>
                              </div>

                              {aiConfigTestResult && (() => {
                                try {
                                  const parsed = JSON.parse(aiConfigTestResult);
                                  return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('originalItem')}</span>
                                        <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)' }}>"{aiConfigTestItem}"</span>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('correctedItemByAi')}</span>
                                        <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-warning)' }}>"{parsed.corrected}"</span>
                                      </div>
                                      {parsed.unit && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('recommendedUnit')}</span>
                                          <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-info)' }}>"{parsed.unit}"</span>
                                        </div>
                                      )}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('determinedCategory')}</span>
                                        <span style={{
                                          padding: '4px 10px',
                                          borderRadius: '20px',
                                          fontSize: '11px',
                                          fontWeight: '700',
                                          color: 'white',
                                          background: parsed.category === 'Alimentos' ? '#10b981' :
                                                      parsed.category === 'Higiene' ? '#8b5cf6' :
                                                      parsed.category === 'Limpeza' ? '#3b82f6' :
                                                      parsed.category === 'Farmácia' ? '#ef4444' :
                                                      parsed.category === 'Pet' ? '#f59e0b' :
                                                      parsed.category === 'Bebê' ? '#ec4899' :
                                                      parsed.category === 'Casa & Utensílios' ? '#14b8a6' :
                                                      parsed.category === 'Sem categoria' ? '#9ca3af' : '#6b7280'
                                        }}>
                                          {t(getCategoryTranslationKey(parsed.category))}
                                        </span>
                                      </div>
                                      {parsed.error && (
                                        <div style={{ fontSize: '10px', color: '#ef4444', fontStyle: 'italic', marginTop: '4px' }}>
                                          {t('aiFallbackActive')} {parsed.error}
                                        </div>
                                      )}
                                    </div>
                                  );
                                } catch {
                                  return (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                                      <span style={{ fontSize: '12px', color: '#ef4444' }}>{aiConfigTestResult}</span>
                                    </div>
                                  );
                                }
                              })()}
                            </div>
                          </div>
                        </div>
                      )}
                      {/* 1. MEU PERFIL */}
                      {activeSettingsSection === 'profile' && currentUser && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <User size={18} style={{ color: 'var(--accent-primary)' }} />
                            </div>
                            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>{t('myProfileHeader')}</h3>
                          </div>

                          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              <div>
                                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>{t('fullName')}</label>
                                <input
                                  type="text"
                                  className="input-field"
                                  style={{ padding: '8px 12px', fontSize: '13px' }}
                                  value={profileDisplayName}
                                  onChange={(e) => setProfileDisplayName(e.target.value)}
                                  placeholder={t('fullNamePlaceholder')}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>{t('usernameLoginHandle')}</label>
                                <input
                                  type="text"
                                  className="input-field"
                                  style={{ padding: '8px 12px', fontSize: '13px' }}
                                  value={profileUsername}
                                  onChange={(e) => setProfileUsername(e.target.value)}
                                  placeholder={t('usernamePlaceholder')}
                                />
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              <div>
                                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>{t('familyTitle')}</label>
                                <select
                                  className="input-field"
                                  style={{ padding: '8px 12px', fontSize: '13px', height: '38px' }}
                                  value={profileFamilyTitle}
                                  onChange={(e) => setProfileFamilyTitle(e.target.value)}
                                >
                                  <option value="Pai">{t('titleFather')}</option>
                                  <option value="Mãe">{t('titleMother')}</option>
                                  <option value="Filho">{t('titleSon')}</option>
                                  <option value="Filha">{t('titleDaughter')}</option>
                                  <option value="Avô">{t('titleGrandfather')}</option>
                                  <option value="Avó">{t('titleGrandmother')}</option>
                                  <option value="Tio">{t('titleUncle')}</option>
                                  <option value="Tia">{t('titleAunt')}</option>
                                  <option value="Outro">{t('titleOther')}</option>
                                </select>
                              </div>
                              <div>
                                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>{t('newPassword')}</label>
                                <input
                                  type="password"
                                  className="input-field"
                                  style={{ padding: '8px 12px', fontSize: '13px' }}
                                  value={profilePassword}
                                  onChange={(e) => setProfilePassword(e.target.value)}
                                  placeholder={isAuthenticated ? t('fillToChange') : t('inactiveInDemo')}
                                  disabled={!isAuthenticated}
                                />
                              </div>
                            </div>

                            {profileSaveSuccess && (
                              <div style={{ padding: '10px 12px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', borderRadius: 'var(--radius-md)', fontSize: '12px', fontWeight: '500' }}>
                                {profileSaveSuccess}
                              </div>
                            )}

                            {profileSaveError && (
                              <div style={{ padding: '10px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', borderRadius: 'var(--radius-md)', fontSize: '12px', fontWeight: '500' }}>
                                {profileSaveError}
                              </div>
                            )}

                            <button
                              type="submit"
                              className="btn-primary"
                              style={{ padding: '10px 20px', fontSize: '13px', alignSelf: 'flex-start', marginTop: '4px' }}
                            >
                              {t('saveChanges')}
                            </button>
                          </form>
                        </div>
                      )}

                      {/* 2. MINHA FAMÍLIA */}
                      {activeSettingsSection === 'family' && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Users size={18} style={{ color: 'var(--accent-success)' }} />
                            </div>
                            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>{t('myFamily')}</h3>
                          </div>



                          {/* ADMINISTRAÇÃO DA FAMÍLIA */}
                          {currentUser && currentUser.role === 'admin' && (
                            <div>
                              <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px', color: 'var(--accent-primary-hover)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('administrativeManagement')}</h4>
                              
                              {/* Alterar Nome da Família */}
                              <div style={{ marginBottom: '18px' }}>
                                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>{t('changeFamilyName')}</label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                  <input
                                    type="text"
                                    className="input-field"
                                    style={{ padding: '8px 12px', fontSize: '14px' }}
                                    value={newFamilyName !== undefined && newFamilyName !== '' ? newFamilyName : (family ? family.name : '')}
                                    onChange={(e) => setNewFamilyName(e.target.value)}
                                    placeholder={t('familyNamePlaceholder')}
                                  />
                                  <button
                                    onClick={() => handleUpdateFamilyName(newFamilyName || (family ? family.name : ''))}
                                    className="btn-primary"
                                    style={{ padding: '8px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
                                  >
                                    {t('updateButton')}
                                  </button>
                                </div>
                              </div>

                              {/* Tabela de Membros */}
                              <div style={{ marginBottom: '20px' }}>
                                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>{t('manageMembers')}</label>
                                {familyMembers.length === 0 ? (
                                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.01)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                                    {t('loadingMembers')}
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {familyMembers.map((member) => (
                                      <div
                                        key={member.id}
                                        style={{
                                          display: 'grid',
                                          gridTemplateColumns: '1.2fr 1fr 1fr 40px 40px',
                                          alignItems: 'center',
                                          gap: '10px',
                                          background: 'rgba(255,255,255,0.02)',
                                          padding: '10px 12px',
                                          borderRadius: 'var(--radius-md)',
                                          border: '1px solid var(--border-light)'
                                        }}
                                      >
                                        <div style={{ fontSize: '13px', fontWeight: '600', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                          {member.display_name || member.username} {member.id === currentUser.id && <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>({t('youLabel')})</span>}
                                          {(member.display_name && member.display_name !== member.username) && (
                                            <div style={{ fontSize: '11px', fontWeight: '400', color: 'var(--text-secondary)' }}>@{member.username}</div>
                                          )}
                                        </div>
                                        
                                        <select
                                          className="input-field"
                                          style={{ padding: '6px 10px', fontSize: '12px', height: '34px' }}
                                          value={member.family_title || 'Outro'}
                                          onChange={(e) => handleUpdateMember(member.id, undefined, e.target.value)}
                                        >
                                          <option value="Pai">{t('titleFather')}</option>
                                          <option value="Mãe">{t('titleMother')}</option>
                                          <option value="Filho">{t('titleSon')}</option>
                                          <option value="Filha">{t('titleDaughter')}</option>
                                          <option value="Avô">{t('titleGrandfather')}</option>
                                          <option value="Avó">{t('titleGrandmother')}</option>
                                          <option value="Tio">{t('titleUncle')}</option>
                                          <option value="Tia">{t('titleAunt')}</option>
                                          <option value="Outro">{t('titleOther')}</option>
                                        </select>

                                        <select
                                          className="input-field"
                                          style={{ padding: '6px 10px', fontSize: '12px', height: '34px' }}
                                          value={member.role}
                                          onChange={(e) => handleUpdateMember(member.id, e.target.value, undefined)}
                                          disabled={member.id === currentUser.id || member.id === family?.creator_id}
                                          title={member.id === family?.creator_id ? t('creatorMustBeAdmin') : undefined}
                                        >
                                          <option value="admin">{t('roleAdmin')}</option>
                                          <option value="user">{t('roleUser')}</option>
                                        </select>

                                        <button
                                          onClick={() => {
                                            setResetPasswordMemberId(member.id);
                                            setResetPasswordNewValue('');
                                          }}
                                          className="btn-secondary"
                                          style={{
                                            height: '34px',
                                            width: '34px',
                                            padding: '0',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderColor: 'rgba(245, 158, 11, 0.2)',
                                            color: 'var(--accent-warning)',
                                            background: 'rgba(245, 158, 11, 0.05)'
                                          }}
                                          title={t('resetUserPassword')}
                                        >
                                          <Key size={14} />
                                        </button>

                                        <button
                                          onClick={() => handleEvictMember(member.id)}
                                          disabled={member.id === currentUser.id || member.id === family?.creator_id}
                                          className="btn-secondary"
                                          style={{
                                            height: '34px',
                                            width: '34px',
                                            padding: '0',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderColor: (member.id === currentUser.id || member.id === family?.creator_id) ? 'transparent' : 'rgba(239, 68, 68, 0.2)',
                                            color: (member.id === currentUser.id || member.id === family?.creator_id) ? 'var(--text-muted)' : 'var(--accent-danger)',
                                            opacity: (member.id === currentUser.id || member.id === family?.creator_id) ? 0.3 : 1
                                          }}
                                          title={member.id === family?.creator_id ? t('creatorCannotBeRemoved') : t('removeFamilyMember')}
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Adicionar Novo Integrante Manualmente */}
                              <div style={{ background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                  <UserPlus size={16} style={{ color: 'var(--accent-primary-hover)' }} />
                                  <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.3px', margin: 0 }}>{t('addMemberManually')}</label>
                                </div>
                                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                                  {t('addMemberManuallyDesc')}
                                </p>
                                
                                <form onSubmit={handleAddMember} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                                    <div>
                                      <input
                                        type="text"
                                        className="input-field"
                                        style={{ padding: '8px 10px', fontSize: '13px' }}
                                        value={addMemUsername}
                                        onChange={(e) => setAddMemUsername(e.target.value)}
                                        placeholder={t('addMemberUsernamePlaceholder')}
                                        required
                                      />
                                    </div>
                                  </div>

                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', alignItems: 'center' }}>
                                    <div>
                                      <input
                                        type="password"
                                        className="input-field"
                                        style={{ padding: '8px 10px', fontSize: '13px' }}
                                        value={addMemPassword}
                                        onChange={(e) => setAddMemPassword(e.target.value)}
                                        placeholder={t('temporaryPasswordPlaceholder')}
                                      />
                                    </div>
                                    
                                    <div>
                                      <select
                                        className="input-field"
                                        style={{ padding: '8px 10px', fontSize: '12px', height: '38px' }}
                                        value={addMemTitle}
                                        onChange={(e) => setAddMemTitle(e.target.value)}
                                      >
                                        <option value="Pai">{t('titleFather')}</option>
                                        <option value="Mãe">{t('titleMother')}</option>
                                        <option value="Filho">{t('titleSon')}</option>
                                        <option value="Filha">{t('titleDaughter')}</option>
                                        <option value="Avô">{t('titleGrandfather')}</option>
                                        <option value="Avó">{t('titleGrandmother')}</option>
                                        <option value="Tio">{t('titleUncle')}</option>
                                        <option value="Tia">{t('titleAunt')}</option>
                                        <option value="Outro">{t('titleOther')}</option>
                                      </select>
                                    </div>

                                    <div>
                                      <select
                                        className="input-field"
                                        style={{ padding: '8px 10px', fontSize: '12px', height: '38px' }}
                                        value={addMemRole}
                                        onChange={(e) => setAddMemRole(e.target.value)}
                                      >
                                        <option value="user">{t('roleSelectorUser')}</option>
                                        <option value="admin">{t('roleSelectorAdmin')}</option>
                                      </select>
                                    </div>
                                  </div>

                                  <button
                                    type="submit"
                                    className="btn-primary"
                                    style={{
                                      padding: '10px 16px',
                                      fontSize: '13px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '6px',
                                      alignSelf: 'flex-start',
                                      marginTop: '4px'
                                    }}
                                  >
                                    <UserPlus size={14} />
                                    {t('addMemberButton')}
                                  </button>
                                </form>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 3. CONEXÃO & SERVIDOR */}
                      {activeSettingsSection === 'server' && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(6, 182, 212, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Database size={18} style={{ color: 'var(--accent-info)' }} />
                            </div>
                            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>{t('serverAndDatabase')}</h3>
                          </div>



                          {/* Backup e Recuperação (Disaster Recovery) */}
                          {currentUser?.role === 'admin' && (
                            <div style={{ marginBottom: '24px', borderBottom: '1px solid var(--border-light)', paddingBottom: '20px' }}>
                              <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Shield size={16} style={{ color: 'var(--accent-warning)' }} />
                                {t('backupCenterTitle')}
                              </h4>
                              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                {t('backupCenterDesc')}
                              </p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                <button
                                  onClick={handleExportBackup}
                                  className="btn-primary"
                                  style={{
                                    padding: '10px 18px',
                                    fontSize: '13px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: '600',
                                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                                  }}
                                >
                                  <Download size={15} />
                                  {t('exportBackupBtn')}
                                </button>

                                <label
                                  className="btn-secondary"
                                  style={{
                                    padding: '10px 18px',
                                    fontSize: '13px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    cursor: 'pointer',
                                    borderColor: 'rgba(59, 130, 246, 0.4)',
                                    color: '#60a5fa',
                                    background: 'rgba(59, 130, 246, 0.05)',
                                    borderRadius: '8px',
                                    fontWeight: '600'
                                  }}
                                >
                                  <Upload size={15} />
                                  {t('importBackupBtn')}
                                  <input
                                    type="file"
                                    accept=".json"
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                      if (e.target.files && e.target.files[0]) {
                                        handleImportBackup(e.target.files[0]);
                                      }
                                    }}
                                  />
                                </label>
                              </div>

                              {/* Snapshots de Backup Rotativos Locais */}
                              <div style={{ marginTop: '20px', borderTop: '1px dashed rgba(255, 255, 255, 0.1)', paddingTop: '16px' }}>
                                <h5 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Clock size={14} style={{ color: 'var(--accent-primary)' }} />
                                  {t('internalSnapshotsTitle')}
                                </h5>
                                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                                  {t('internalSnapshotsDesc')}
                                </p>
                                
                                {localBackupsIndex.length === 0 ? (
                                  <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)', textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                                    {t('noLocalSnapshots')}
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                                    {localBackupsIndex.map((bk) => (
                                      <div key={bk.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-light)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                          <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>{bk.label}</span>
                                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{new Date(bk.timestamp).toLocaleString(LOCALE_MAP[language] || 'en-US')}</span>
                                        </div>
                                        <button
                                          onClick={() => handleRestoreLocalBackup(bk.id)}
                                          className="btn-secondary"
                                          style={{ padding: '5px 10px', fontSize: '11px', borderRadius: '6px', cursor: 'pointer', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#34d399', background: 'rgba(16, 185, 129, 0.05)' }}
                                        >
                                          {t('restoreBtn')}
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                
                                <button
                                  onClick={handleCreateManualLocalBackup}
                                  className="btn-secondary"
                                  style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '6px', borderColor: 'rgba(139, 92, 246, 0.3)', color: '#a78bfa', background: 'rgba(139, 92, 246, 0.05)', fontWeight: '600' }}
                                >
                                  {t('createInstantSnapshotBtn')}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Reiniciar Ciclo de Atividades */}
                          {currentUser?.role === 'admin' && (
                            <div style={{ marginBottom: '24px' }}>
                              <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Award size={16} style={{ color: 'var(--accent-primary)' }} />
                                {t('resetRoutinesTitle')}
                              </h4>
                              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                                {t('resetRoutinesDesc')}
                              </p>
                              <button
                                onClick={handleResetPoints}
                                className="btn-primary"
                                style={{
                                  padding: '10px 18px',
                                  fontSize: '13px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-primary-hover) 100%)',
                                  border: 'none',
                                  borderRadius: '8px',
                                  fontWeight: '600',
                                  boxShadow: '0 4px 12px rgba(139, 92, 246, 0.2)'
                                }}
                              >
                                <Award size={15} />
                                {t('resetFamilyScores')}
                              </button>
                            </div>
                          )}

                          {/* Redefinição e Limpeza do Banco de Dados */}
                          {currentUser?.role === 'admin' && (
                            <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
                              <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'var(--accent-danger)' }}>{t('dangerZone')}</h4>
                              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>{t('destructiveActionsDesc')}</p>
                              <button
                                  onClick={async () => {
                                    if (confirm(t('confirmResetDatabase'))) {
                                      try {
                                        // 0. Chamar API do backend para apagar e re-semear o banco de dados do servidor
                                        if (isOnline && token) {
                                          await fetch(`${backendUrl}/api/family/reset-database`, {
                                            method: 'POST',
                                            headers: {
                                              'Authorization': `Bearer ${token}`
                                            }
                                          }).catch(e => console.error("Erro ao resetar banco do servidor:", e));
                                        }
                                        // 1. Limpar todas as tabelas do IndexedDB local com Dexie de forma segura e não-bloqueante
                                        await Promise.all(db.tables.map(table => table.clear().catch(() => {})));
                                        // 2. Limpar metadados extras e o token
                                        await db.metadata.clear().catch(() => {});
                                        // 3. Forçar o reload da aplicação para começar do zero
                                        window.location.reload();
                                      } catch (err) {
                                        console.error("Erro ao redefinir banco local:", err);
                                        alert(t('dbResetErrorMsg'));
                                      }
                                    }
                                  }}
                                  className="btn-secondary"
                                  style={{ color: 'var(--accent-danger)', borderColor: 'rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)', padding: '8px 16px', fontSize: '13px' }}
                              >
                                {t('clearDatabaseAndRestart')}
                              </button>
                            </div>
                          )}
                        </div>
                      )}



                    </div>
                  )}
                </div>
              )}



            </div>
          </>
        )}

      </main>

      {/* FOOTER DESCRITIVO */}
      <footer className="app-footer">
        {t('footerText')}
      </footer>

      {/* MODAL DE CRIAÇÃO DE NOVA ROTINA (GOOGLE CALENDAR STYLE) */}
      {showChoreFormModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(10, 10, 12, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px',
          overflowY: 'auto'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '680px',
            width: '100%',
            background: 'rgba(25, 25, 30, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            maxHeight: '90vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <h3 style={{ fontSize: '20px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)', margin: 0 }}>
                <PlusCircle size={22} style={{ color: 'var(--accent-primary)' }} />
                <span>{editingChore ? t('editChoreOrMed') : t('scheduleNewChoreOrMed')}</span>
              </h3>
              <button
                onClick={() => {
                  setShowChoreFormModal(false);
                  resetChoreForm();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '18px',
                  fontWeight: '600',
                  padding: '4px'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleCreateChore} className="responsive-modal-content" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Título */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span>{t('titleField')}</span>
                  {isEnrichingChore && (
                    <span style={{ color: '#ec4899', fontSize: '11px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span className="spinner-border" style={{
                        width: '10px',
                        height: '10px',
                        border: '2px solid #ec4899',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        display: 'inline-block',
                        animation: 'spin 0.6s linear infinite'
                      }} />
                      {t('aiSuggestingDetails')}
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder={t('choreTitlePlaceholder')}
                  value={newChoreTitle}
                  onChange={(e) => setNewChoreTitle(e.target.value)}
                  onBlur={handleChoreTitleBlur}
                  required
                  style={{ fontSize: '15px' }}
                  disabled={isEnrichingChore}
                />
              </div>

              {/* Descrição */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>{t('descriptionField')}</label>
                <textarea
                  className="input-field"
                  style={{ minHeight: '60px', resize: 'vertical' }}
                  placeholder={isEnrichingChore ? t('waitingAiSuggestion') : t('additionalInstructionsPlaceholder')}
                  value={newChoreDesc}
                  onChange={(e) => setNewChoreDesc(e.target.value)}
                  disabled={isEnrichingChore}
                />
              </div>

              {/* Linha 1: Atribuído, Co-responsável e Pontos */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>{t('mainResponsible')}</label>
                  <select className="input-field" value={newChoreAssigned} onChange={(e) => setNewChoreAssigned(e.target.value)} disabled={isEnrichingChore || (currentUser && currentUser.role !== 'admin')}>
                    <option value="all">{t('wholeFamilyFree')}</option>
                    {familyMembers.map((member: any) => (
                      <option key={member.id} value={member.username}>
                        {member.display_name || member.username} ({member.family_title || member.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>{t('coResponsible')}</label>
                  <select className="input-field" value={newChoreCoResponsible} onChange={(e) => setNewChoreCoResponsible(e.target.value)} disabled={isEnrichingChore}>
                    <option value="none">{t('none')}</option>
                    {familyMembers.map((member: any) => (
                      <option key={member.id} value={member.username}>
                        {member.display_name || member.username} ({member.family_title || member.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>{t('pointsXp')}</label>
                  <input
                    type="number"
                    className="input-field"
                    value={newChorePoints}
                    onChange={(e) => setNewChorePoints(Number(e.target.value))}
                    disabled={isEnrichingChore}
                  />
                </div>
              </div>

              {/* Seção de Agendamento e Repetição */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--accent-primary-hover)', display: 'block', marginBottom: '12px' }}>{t('dateScheduling')}</label>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t('startDate')}</label>
                    <input
                      type="date"
                      className="input-field"
                      value={newChoreStartDate}
                      onChange={(e) => setNewChoreStartDate(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t('endDateOptional')}</label>
                    <input
                      type="date"
                      className="input-field"
                      value={newChoreEndDate}
                      onChange={(e) => setNewChoreEndDate(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <input
                    type="checkbox"
                    id="repeatsChore"
                    checked={newChoreRepeats}
                    onChange={(e) => setNewChoreRepeats(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                  />
                  <label htmlFor="repeatsChore" style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', cursor: 'pointer' }}>
                    {t('activityRepeats')}
                  </label>
                </div>

                {newChoreRepeats && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t('frequency')}</label>
                        <select className="input-field" value={newChoreRecurrenceType} onChange={(e: any) => setNewChoreRecurrenceType(e.target.value)}>
                          <option value="daily">{t('recurrenceDaily')}</option>
                          <option value="weekly">{t('recurrenceWeekly')}</option>
                          <option value="monthly">{t('recurrenceMonthly')}</option>
                          <option value="custom_days">{t('recurrenceCustomDays')}</option>
                        </select>
                      </div>

                      {newChoreRecurrenceType !== 'custom_days' && (
                        <div>
                          <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                            {t('recurrenceIntervalLabel').replace('{unit}', newChoreRecurrenceType === 'daily' ? t('unitDays') : newChoreRecurrenceType === 'weekly' ? t('unitWeeks') : t('unitMonths'))}
                          </label>
                          <input
                            type="number"
                            min="1"
                            className="input-field"
                            value={newChoreRecurrenceInterval}
                            onChange={(e) => setNewChoreRecurrenceInterval(Number(e.target.value))}
                          />
                        </div>
                      )}
                    </div>

                    {(newChoreRecurrenceType === 'weekly' || newChoreRecurrenceType === 'custom_days') && (
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>{t('chooseWeekdays')}</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, idx) => {
                            const isSelected = newChoreRecurrenceDays.includes(day);
                            const localizedLabel = getLocalizedWeekdays(language, 'short')[idx];
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setNewChoreRecurrenceDays(newChoreRecurrenceDays.filter(d => d !== day));
                                  } else {
                                    setNewChoreRecurrenceDays([...newChoreRecurrenceDays, day]);
                                  }
                                }}
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  border: '1px solid',
                                  background: isSelected ? 'var(--accent-primary)' : 'rgba(255,255,255,0.03)',
                                  color: isSelected ? '#fff' : 'var(--text-secondary)',
                                  borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-light)',
                                  transition: 'all 0.15s'
                                }}
                              >
                                {localizedLabel}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Seção de Horário */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--accent-primary-hover)', display: 'block', marginBottom: '12px' }}>{t('activityTime')}</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t('timeFormat')}</label>
                    <select className="input-field" value={newChoreTimeType} onChange={(e: any) => setNewChoreTimeType(e.target.value)}>
                      <option value="all_day">{t('timeAllDay')}</option>
                      <option value="fixed">{t('timeFixed')}</option>
                      <option value="period">{t('timePeriod')}</option>
                    </select>
                  </div>

                  {newChoreTimeType === 'fixed' && (
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t('setTime')}</label>
                      <input
                        type="time"
                        className="input-field"
                        value={newChoreFixedTime}
                        onChange={(e) => setNewChoreFixedTime(e.target.value)}
                      />
                    </div>
                  )}

                  {newChoreTimeType === 'period' && (
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t('selectPeriod')}</label>
                      <select className="input-field" value={newChorePeriodTime} onChange={(e: any) => setNewChorePeriodTime(e.target.value)}>
                        <option value="manha">🌅 {t('periodMorning')}</option>
                        <option value="tarde">☀️ {t('periodAfternoon')}</option>
                        <option value="noite">🌙 {t('periodEvening')}</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Checkbox para se é medicamento */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="isMedicationChore"
                  checked={newChoreIsMed}
                  onChange={(e) => setNewChoreIsMed(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                />
                <label htmlFor="isMedicationChore" style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  {t('isMedicationLabel')}
                </label>
              </div>

              {/* Seção Medicamento: Ciclo de Dosagens Sequenciais */}
              {newChoreIsMed && (
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--accent-info)', display: 'block', marginBottom: '8px' }}>
                    {t('sequentialDosageCycle')}
                  </label>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: '1.4' }}>
                    {t('sequentialDosageDesc')}
                  </p>

                  {/* Frequência de doses e Duração */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px', marginBottom: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        {t('dosageFrequency')}
                      </label>
                      <select
                        className="input-field"
                        style={{ padding: '6px 12px', fontSize: '13px', background: 'rgba(0,0,0,0.2)' }}
                        value={newChoreMedFrequency}
                        onChange={(e) => setNewChoreMedFrequency(e.target.value)}
                        disabled={!!editingChore}
                      >
                        <option value="1">{t('freqOnceDaily')}</option>
                        <option value="2">{t('freqTwiceDaily')}</option>
                        <option value="3">{t('freqThriceDaily')}</option>
                        <option value="4">{t('freqFourTimesDaily')}</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        {t('treatmentDuration')}
                      </label>
                      <select
                        className="input-field"
                        style={{ padding: '6px 12px', fontSize: '13px', background: 'rgba(0,0,0,0.2)' }}
                        value={newChoreMedDuration}
                        onChange={(e) => setNewChoreMedDuration(Number(e.target.value))}
                        disabled={!!editingChore}
                      >
                        <option value="1">{t('durOneDay')}</option>
                        <option value="3">{t('daysCount').replace('{count}', '3')}</option>
                        <option value="5">{t('daysCount').replace('{count}', '5')}</option>
                        <option value="7">{t('durOneWeek')}</option>
                        <option value="10">{t('daysCount').replace('{count}', '10')}</option>
                        <option value="14">{t('durTwoWeeks')}</option>
                        <option value="30">{t('durOneMonth')}</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    {newChoreMedCycle.map((dose, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', width: '50px', fontWeight: '600' }}>{t('dayCountLabel').replace('{count}', String(idx + 1))}</span>
                        <input
                          type="text"
                          className="input-field"
                          style={{ padding: '6px 12px', fontSize: '13px' }}
                          placeholder={t('dosePlaceholder')}
                          value={dose}
                          onChange={(e) => {
                            const updated = [...newChoreMedCycle];
                            updated[idx] = e.target.value;
                            setNewChoreMedCycle(updated);
                          }}
                          required
                        />
                        {newChoreMedCycle.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = newChoreMedCycle.filter((_, i) => i !== idx);
                              setNewChoreMedCycle(updated);
                            }}
                            style={{ border: 'none', background: 'none', color: 'var(--accent-danger)', cursor: 'pointer', padding: '4px' }}
                            title={t('removeStep')}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setNewChoreMedCycle([...newChoreMedCycle, t('defaultDoseValue')])}
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={12} />
                    <span>{t('addDoseToCycle')}</span>
                  </button>
                </div>
              )}

              {/* Botões do Formulário */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
                {editingChore && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(t('confirmDeleteActivity').replace('{title}', editingChore.title))) {
                        handleDeleteChore(editingChore.id);
                      }
                    }}
                    className="btn-secondary"
                    style={{ padding: '10px 20px', color: 'var(--accent-danger)', borderColor: 'rgba(239, 68, 68, 0.2)', marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Trash2 size={16} />
                    <span>{t('delete')}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowChoreFormModal(false);
                    resetChoreForm();
                  }}
                  className="btn-secondary"
                  style={{ padding: '10px 20px' }}
                >
                  {t('cancel')}
                </button>
                <button type="submit" className="btn-primary" style={{ padding: '10px 24px' }}>
                  {editingChore ? (
                    <>
                      <Check size={16} />
                      <span>{t('saveChanges')}</span>
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      <span>{t('createChore')}</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL ADMINISTRATIVO DE REDEFINIÇÃO DE SENHA */}
      {resetPasswordMemberId !== null && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(10, 10, 12, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '420px',
            width: '100%',
            background: 'rgba(25, 25, 30, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            position: 'relative',
            animation: 'scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Key size={18} style={{ color: 'var(--accent-warning)' }} />
              {t('resetMemberPassword')}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.4' }}>
              {t('resetPasswordModalDesc').split('{name}')[0]}
              <strong>{familyMembers.find(m => m.id === resetPasswordMemberId)?.display_name || familyMembers.find(m => m.id === resetPasswordMemberId)?.username}</strong>
              {t('resetPasswordModalDesc').split('{name}')[1]}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>{t('newTemporaryPassword')}</label>
                <input
                  type="password"
                  className="input-field"
                  style={{ padding: '10px 12px', fontSize: '14px' }}
                  placeholder={t('temporaryPasswordInputPlaceholder')}
                  value={resetPasswordNewValue}
                  onChange={(e) => setResetPasswordNewValue(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setResetPasswordMemberId(null);
                  setResetPasswordNewValue('');
                }}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={async () => {
                  const success = await handleResetMemberPassword(resetPasswordMemberId, resetPasswordNewValue);
                  if (success) {
                    setResetPasswordMemberId(null);
                    setResetPasswordNewValue('');
                  }
                }}
                style={{ padding: '8px 20px', fontSize: '13px' }}
              >
                {t('saveNewPassword')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPONENTE GLOBAL DE TOASTS FLUTUANTES PREMIUM */}
      {toast.message && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            padding: '14px 20px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-glass)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid',
            borderColor: toast.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : toast.type === 'error' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(6, 182, 212, 0.4)',
            boxShadow: 'var(--shadow-lg), 0 10px 30px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            maxWidth: '350px',
            animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: toast.type === 'success' ? 'var(--accent-success)' : toast.type === 'error' ? 'var(--accent-danger)' : 'var(--accent-info)',
              boxShadow: `0 0 8px ${toast.type === 'success' ? 'var(--accent-success)' : toast.type === 'error' ? 'var(--accent-danger)' : 'var(--accent-info)'}`
            }}
          />
          <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', lineHeight: '1.4' }}>
            {toast.message.split('**').map((part, idx) =>
              idx % 2 === 1 ? (
                <strong key={idx} style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{part}</strong>
              ) : (
                part
              )
            )}
          </span>
          <button
            onClick={() => setToast({ message: '', type: null, id: null })}
            style={{
              border: 'none',
              background: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '14px',
              marginLeft: 'auto',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              transition: 'all var(--transition-fast)'
            }}
            className="glass-panel-hover"
          >
            &times;
          </button>
        </div>
      )}

    </div>
  );
}

export default App;
