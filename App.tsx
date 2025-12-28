import React, { useState, useEffect, useRef } from 'react';
import {
   ChevronDown, ChevronRight, X, CreditCard, DollarSign, Globe,
   Home, Plus, PieChart as PieChartIcon, MessageSquare, Settings as SettingsIcon,
   Sparkles, Loader2, Send, Trash2, Edit2, Calendar, CheckCircle,
   Search, Filter, Download, User as UserIcon, RefreshCw, AlertCircle,
   Smartphone, Moon, Sun, Monitor, Calculator, Tag, Wallet, Briefcase,
   CalendarDays, BarChart as BarChartIcon, ExternalLink, Layers, List,
   CreditCard as CreditCardIcon, LogOut, Users, Lock, KeyRound, Copy,
   ArrowUpRight, ArrowDownRight, TrendingUp, ShoppingBag, Zap, LayoutDashboard,
   MoreHorizontal, CreditCard as CardIcon, ShieldCheck, Bell, Mail, Phone, MessageCircle,
   CalendarClock, SkipForward, Crown, UserCheck
} from 'lucide-react';
import {
   LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
   Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie, AreaChart, Area
} from 'recharts';
import { Transaction, RecurringPattern, CreditCardConfig, User, View, ChatMessage, CreditCardDateOverride, Family, NotificationTrigger } from './types';
import { sendMessageToGemini } from './services/geminiService';
import {
   checkAndNotifyDueItems,
   getCardStatus,
   requestNotificationPermission
} from './services/notificationService';
import { useAuth } from './src/context/AuthContext';
import Login from './src/components/Login';
import Register from './src/components/Register';
import FamilyManager from './src/components/FamilyManager';

// --- HELPERS ---
const getTodayStr = () => {
   const now = new Date();
   const year = now.getFullYear();
   const month = String(now.getMonth() + 1).padStart(2, '0');
   const day = String(now.getDate()).padStart(2, '0');
   return `${year}-${month}-${day}`;
};

const addMonthsSafe = (date: Date, months: number) => {
   const d = new Date(date);
   const currentDay = d.getDate();
   d.setMonth(d.getMonth() + months);
   if (d.getDate() !== currentDay) {
      d.setDate(0);
   }
   return d;
};

const formatCurrency = (amount: number, currency: string) => {
   return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(amount);
};

// AI Studio helpers
interface AIStudio {
   hasSelectedApiKey: () => Promise<boolean>;
   openSelectKey: () => Promise<void>;
}

const getAIStudio = (): AIStudio => (window as any).aistudio;

export default function App() {
   // Auth State
   // Supabase Auth
   const { session, signOut, user: supabaseUser, loading: authLoading } = useAuth();
   const [showRegister, setShowRegister] = useState(false);
   const [newFamilyName, setNewFamilyName] = useState('');

   // Main App State
   const [view, setView] = useState<View>('dashboard');

   // Data
   const [families, setFamilies] = useState<Family[]>([]);
   const [currentFamily, setCurrentFamily] = useState<Family | null>(null);
   const [transactions, setTransactions] = useState<Transaction[]>([]);
   const [recurringPatterns, setRecurringPatterns] = useState<RecurringPattern[]>([]);
   const [users, setUsers] = useState<User[]>([]);
   const [currentUser, setCurrentUser] = useState<User | null>(null);

   // Filtered Data (Derived)
   const familyTransactions = transactions.filter(t => t.familyId === currentFamily?.id);
   const familyPatterns = recurringPatterns.filter(p => p.familyId === currentFamily?.id);
   const familyUsers = users.filter(u => u.familyId === currentFamily?.id);

   // Settings & Config
   const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('dark');
   const [baseCurrency, setBaseCurrency] = useState('ARS');
   const [currencies, setCurrencies] = useState<{ code: string, symbol: string }[]>([
      { code: 'ARS', symbol: '$' },
      { code: 'USD', symbol: 'US$' },
      { code: 'EUR', symbol: '€' },
      { code: 'BRL', symbol: 'R$' },
   ]);
   const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({
      'ARS': 1, 'USD': 1200, 'EUR': 1300, 'BRL': 200
   });
   const [lastRatesUpdate, setLastRatesUpdate] = useState<number | null>(null);
   const [isFetchingRates, setIsFetchingRates] = useState(false);

   // User Profile Editing State
   const [isEditingProfile, setIsEditingProfile] = useState(false);
   const [profileForm, setProfileForm] = useState<Partial<User>>({});

   // Categories
   const [expenseCategories, setExpenseCategories] = useState<Record<string, string[]>>({
      'Food': ['Groceries', 'Dining Out', 'Snacks'],
      'Utilities': ['Electricity', 'Water', 'Gas', 'Internet', 'Phone'],
      'Housing': ['Rent', 'Mortgage', 'Repairs'],
      'Transportation': ['Fuel', 'Public Transit', 'Uber/Taxi', 'Maintenance'],
      'Health': ['Doctor', 'Pharmacy', 'Insurance'],
      'Entertainment': ['Movies', 'Streaming', 'Hobbies'],
      'Credit Card Payment': ['Full Payment', 'Partial Payment'],
      'Other': ['General']
   });
   const [incomeCategories, setIncomeCategories] = useState<Record<string, string[]>>({
      'Salary': ['Full Time', 'Part Time'],
      'Freelance': ['Projects', 'Hourly'],
      'Investments': ['Dividends', 'Interest'],
      'Gifts': ['Family', 'Friends'],
      'Other': ['General']
   });

   // Payment Methods
   const [paymentMethods, setPaymentMethods] = useState<Record<string, string[]>>({
      'Cash': [],
      'Debit Card': ['Visa Debit', 'Mastercard Debit'],
      'Credit Card': ['Visa Gold', 'Mastercard Black', 'Amex'],
      'Bank Transfer': ['Bank A', 'Bank B', 'Mercado Pago'],
      'Other': ['Check', 'Crypto']
   });

   const [creditCardConfigs, setCreditCardConfigs] = useState<Record<string, CreditCardConfig>>({});

   // UI Form State
   const [formData, setFormData] = useState({
      type: 'expense' as 'income' | 'expense',
      amount: '',
      currency: 'ARS',
      description: '',
      title: '',
      category: 'Food',
      subCategory: '',
      paymentMethod: 'Cash',
      paymentSubMethod: '',
      isRecurring: false,
      frequency: 'monthly' as 'weekly' | 'monthly' | 'yearly',
      expirationDate: getTodayStr(),
      dueDate: getTodayStr(),
      duePattern: 'fixed' as 'fixed' | 'relative' | 'last_workday',
      daysBeforeMonth: 0,
      cycleClosingDay: 0,
      notes: '',
      installments: 1,
      applyInterest: false,
      interestRate: 0,
      recurringTitle: '',
      notificationTriggers: [] as NotificationTrigger[]
   });

   // Card Creation Form
   const [isAddingCard, setIsAddingCard] = useState(false);
   const [cardForm, setCardForm] = useState<Partial<CreditCardConfig>>({
      subCategory: '',
      bankName: '',
      cardNetwork: 'Visa',
      last4: '',
      limit: 0,
      closingDay: 24,
      paymentDueGap: 10,
      color: 'from-gray-700 to-gray-900',
      closingRule: 'fixed'
   });
   // Track if we are editing an existing card or creating a new one
   const [editingCardName, setEditingCardName] = useState<string | null>(null);

   const [originalTx, setOriginalTx] = useState<Transaction | null>(null);
   const [editingPattern, setEditingPattern] = useState<RecurringPattern | null>(null);

   const [editingUserId, setEditingUserId] = useState<number | null>(null);
   const [isAddingUser, setIsAddingUser] = useState(false);
   const [newCurrencyCode, setNewCurrencyCode] = useState('');
   const [newCurrencySymbol, setNewCurrencySymbol] = useState('');

   // Settings Management State
   const [settingsSection, setSettingsSection] = useState<'categories' | 'methods' | 'installments' | null>(null);
   const [manageCatType, setManageCatType] = useState<'expense' | 'income'>('expense');
   const [manageNewItem, setManageNewItem] = useState('');
   const [manageNewSubItem, setManageNewSubItem] = useState('');
   const [manageSelectedParent, setManageSelectedParent] = useState<string | null>(null);

   // Dashboard State
   const [dashboardPeriod, setDashboardPeriod] = useState<'6m' | 'ytd' | '1y'>('6m');

   // Analytics State
   const [analyticsYear, setAnalyticsYear] = useState(new Date().getFullYear());
   const [analyticsViewMode, setAnalyticsViewMode] = useState<'year' | 'semester' | 'quarter' | 'month'>('year');
   // analyticsSubSelection: 0-1 for semesters, 0-3 for quarters, 0-11 for months
   const [analyticsSubSelection, setAnalyticsSubSelection] = useState<number>(0);

   const [transactionFilters, setTransactionFilters] = useState({
      search: '',
      type: 'all',
      category: 'all',
      startDate: '',
      endDate: ''
   });

   const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
   const [chatInput, setChatInput] = useState('');
   const [chatLoading, setChatLoading] = useState(false);
   const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

   // --- PERSISTENCE ---
   useEffect(() => {
      const saved = localStorage.getItem('expenseTrackerData_v4');
      if (saved) {
         const data = JSON.parse(saved);
         // Migration: Ensure legacy data has a family ID if it existed
         const defaultFamilyId = 1;
         let loadedFamilies = data.families || [];
         if (loadedFamilies.length === 0 && data.users?.length > 0) {
            loadedFamilies = [{ id: defaultFamilyId, name: 'My Family', joinCode: '1000', createdDate: new Date().toISOString() }];
         }

         setTransactions((data.transactions || []).map((t: any) => ({ ...t, familyId: t.familyId || defaultFamilyId })));
         setRecurringPatterns((data.recurringPatterns || []).map((p: any) => ({ ...p, familyId: p.familyId || defaultFamilyId })));
         // Migration: Ensure users have a role
         setUsers((data.users || []).map((u: any) => ({
            ...u,
            familyId: u.familyId || defaultFamilyId,
            role: u.role || 'admin' // Default legacy users to admin
         })));
         setFamilies(loadedFamilies);

         setExpenseCategories(data.expenseCategories || expenseCategories);
         setIncomeCategories(data.incomeCategories || incomeCategories);
         setPaymentMethods(data.paymentMethods || paymentMethods);
         setCreditCardConfigs(data.creditCardConfigs || {});
         setBaseCurrency(data.baseCurrency || 'ARS');
         setExchangeRates(data.exchangeRates || exchangeRates);
         setCurrencies(data.currencies || currencies);
         setLastRatesUpdate(data.lastRatesUpdate || null);
         setTheme(data.theme || 'system');
      }
      const aiStudio = getAIStudio();
      if (aiStudio && aiStudio.hasSelectedApiKey) {
         aiStudio.hasSelectedApiKey().then(setHasApiKey);
      } else {
         // Local environment fallback
         setHasApiKey(!!import.meta.env.VITE_API_KEY);
      }
   }, []);

   useEffect(() => {
      localStorage.setItem('expenseTrackerData_v4', JSON.stringify({
         families, transactions, recurringPatterns, users,
         expenseCategories, incomeCategories, paymentMethods, creditCardConfigs,
         baseCurrency, exchangeRates, currencies, lastRatesUpdate, theme
      }));
   }, [families, transactions, recurringPatterns, users, expenseCategories, incomeCategories, paymentMethods, creditCardConfigs, baseCurrency, exchangeRates, currencies, lastRatesUpdate, theme]);

   useEffect(() => {
      const html = document.documentElement;
      const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) html.classList.add('dark');
      else html.classList.remove('dark');
   }, [theme]);

   useEffect(() => {
      // Only notify if we are in app mode
      if (currentFamily) { // authStep is no longer used for app mode check
         checkAndNotifyDueItems(familyPatterns, familyUsers, familyTransactions, creditCardConfigs);
      }
   }, [currentFamily, recurringPatterns, users, transactions, creditCardConfigs]);

   // --- AUTH HANDLERS ---
   const handleLogout = async () => {
      await signOut();
      setCurrentFamily(null);
      setCurrentUser(null);
      setView('dashboard');
   };

   const onFamilySelected = (family: Family) => {
      setCurrentFamily(family);
      // Find or create local user mapping for this session
      if (supabaseUser) {
         // Here we ideally sync with the 'users' table in DB, but for now we map locally
         const localUser: User = {
            id: supabaseUser.id,
            email: supabaseUser.email || '',
            name: supabaseUser.email?.split('@')[0] || 'User',
            role: 'admin', // Default to admin for now
            familyId: family.id,
            notificationMethod: 'email'
         };
         setCurrentUser(localUser);
      }
   };

   // --- USER PROFILE HANDLERS ---
   const handleEditProfile = () => {
      if (!currentUser) return;
      // Split name into first and last if not already set, for editing convenience
      const parts = currentUser.name.split(' ');
      const firstName = currentUser.firstName || parts[0] || '';
      const lastName = currentUser.lastName || parts.slice(1).join(' ') || '';

      setProfileForm({ ...currentUser, firstName, lastName });
      setIsEditingProfile(true);
   };

   const handleSaveProfile = () => {
      if (!currentUser || !profileForm) return;

      const fullName = `${profileForm.firstName || ''} ${profileForm.lastName || ''}`.trim();
      const updatedUser = { ...currentUser, ...profileForm, name: fullName || currentUser.name };

      // Update local users array
      setUsers(users.map(u => u.id === currentUser.id ? updatedUser : u));

      // Update current user session
      setCurrentUser(updatedUser);
      setIsEditingProfile(false);
   };

   const handleUpdateUserRole = (targetUserId: number, newRole: 'admin' | 'member') => {
      if (currentUser?.role !== 'admin') return;
      if (targetUserId === currentUser.id) return alert("No puedes cambiar tu propio rol.");

      setUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, role: newRole } : u));
   };

   // --- TRANSACTION HANDLERS ---
   const convertAmount = (amount: number, fromCurrency: string, toCurrency: string) => {
      if (fromCurrency === toCurrency) return amount;
      let amountInBase = fromCurrency === baseCurrency ? amount : amount * (exchangeRates[fromCurrency] || 1);
      return toCurrency === baseCurrency ? amountInBase : amountInBase / (exchangeRates[toCurrency] || 1);
   };

   const handleFetchRates = async () => {
      setIsFetchingRates(true);
      try {
         const res = await fetch(`https://open.er-api.com/v6/latest/${baseCurrency}`);
         const data = await res.json();
         if (data && data.rates) {
            const newRates = { ...exchangeRates };
            currencies.forEach(c => {
               if (c.code === baseCurrency) newRates[c.code] = 1;
               else if (data.rates[c.code]) newRates[c.code] = 1 / data.rates[c.code];
            });
            setExchangeRates(newRates);
            setLastRatesUpdate(Date.now());
         }
      } catch (e) { alert("Failed to fetch rates."); }
      finally { setIsFetchingRates(false); }
   };

   const resetForm = () => {
      setFormData({
         type: 'expense', amount: '', currency: baseCurrency, description: '', title: '',
         category: Object.keys(expenseCategories)[0] || '', subCategory: '',
         paymentMethod: 'Cash', paymentSubMethod: '', isRecurring: false,
         frequency: 'monthly', expirationDate: getTodayStr(), dueDate: getTodayStr(),
         duePattern: 'fixed', daysBeforeMonth: 0, cycleClosingDay: 0, notes: '',
         installments: 1, applyInterest: false, interestRate: 0, recurringTitle: '',
         notificationTriggers: []
      });
      setOriginalTx(null);
      setEditingPattern(null);
   };

   const handleSaveTransaction = () => {
      if (!currentUser || !currentFamily) return;
      if (!formData.amount || parseFloat(formData.amount) <= 0) return alert("Invalid Amount");
      if (!formData.description) return alert("Description required");

      let finalAmount = parseFloat(formData.amount);
      if (formData.applyInterest && formData.interestRate > 0) finalAmount *= (1 + formData.interestRate / 100);

      if (formData.isRecurring) {
         // Determine dayOfMonth if fixed monthly pattern
         let anchorDay: number | undefined = undefined;
         if (formData.frequency === 'monthly' && formData.duePattern === 'fixed') {
            const datePart = new Date(formData.dueDate);
            // Important: use GetDate (local) to avoid timezone shifts if string is strictly YYYY-MM-DD
            anchorDay = parseInt(formData.dueDate.split('-')[2]);
         }

         const newPattern: RecurringPattern = {
            id: editingPattern ? editingPattern.id : Date.now(),
            familyId: currentFamily.id,
            userId: currentUser.id,
            type: formData.type,
            amount: parseFloat(formData.amount),
            currency: formData.currency,
            description: formData.description,
            title: formData.recurringTitle || formData.description,
            category: formData.category,
            subCategory: formData.subCategory,
            paymentMethod: formData.paymentMethod,
            paymentSubMethod: formData.paymentSubMethod,
            frequency: formData.frequency,
            nextDueDate: formData.dueDate,
            duePattern: formData.duePattern,
            dayOfMonth: anchorDay, // New field to support non-destructive overrides
            notes: formData.notes,
            notificationTriggers: formData.notificationTriggers
         };
         setRecurringPatterns(prev => editingPattern ? prev.map(p => p.id === editingPattern.id ? newPattern : p) : [...prev, newPattern]);
      } else {
         const installments = formData.installments > 1 ? formData.installments : 1;
         const amountPerQuota = parseFloat((finalAmount / installments).toFixed(2));
         const parentId = Date.now();

         if (originalTx) {
            const updatedTx: Transaction = {
               ...originalTx, type: formData.type, amount: parseFloat(formData.amount),
               currency: formData.currency, description: formData.description, title: formData.title,
               category: formData.category, subCategory: formData.subCategory,
               paymentMethod: formData.paymentMethod, paymentSubMethod: formData.paymentSubMethod,
               notes: formData.notes, createdDate: formData.expirationDate ? new Date(formData.expirationDate + 'T12:00:00').toISOString() : originalTx.createdDate
            };
            setTransactions(prev => prev.map(t => t.id === originalTx.id ? updatedTx : t));
         } else {
            const newTxs: Transaction[] = [];
            const baseDate = formData.expirationDate ? new Date(formData.expirationDate + 'T12:00:00') : new Date();
            for (let i = 0; i < installments; i++) {
               newTxs.push({
                  id: Date.now() + i, familyId: currentFamily.id, userId: currentUser.id, userName: currentUser.name,
                  type: formData.type, amount: amountPerQuota, currency: formData.currency,
                  description: formData.description, title: formData.title,
                  category: formData.category, subCategory: formData.subCategory,
                  paymentMethod: formData.paymentMethod, paymentSubMethod: formData.paymentSubMethod,
                  notes: formData.notes, createdDate: addMonthsSafe(baseDate, i).toISOString(),
                  installmentCurrent: installments > 1 ? i + 1 : undefined, installmentTotal: installments > 1 ? installments : undefined,
                  parentId: installments > 1 ? parentId : undefined
               });
            }
            setTransactions(prev => [...prev, ...newTxs]);
         }
      }
      resetForm();
      setView(editingPattern ? 'recurring' : 'dashboard');
   };

   const handleEditTransaction = (tx: Transaction) => {
      setOriginalTx(tx);
      setFormData({
         ...formData, type: tx.type, amount: tx.amount.toString(), currency: tx.currency,
         description: tx.description, title: tx.title || '', category: tx.category,
         subCategory: tx.subCategory || '', paymentMethod: tx.paymentMethod,
         paymentSubMethod: tx.paymentSubMethod || '', isRecurring: false,
         expirationDate: tx.createdDate.split('T')[0], notes: tx.notes
      });
      setView('add');
   };

   const handleEditPattern = (pattern: RecurringPattern) => {
      setEditingPattern(pattern);
      setFormData({
         ...formData, type: pattern.type, amount: pattern.amount.toString(), currency: pattern.currency,
         description: pattern.description, recurringTitle: pattern.title, category: pattern.category,
         subCategory: pattern.subCategory || '', paymentMethod: pattern.paymentMethod,
         paymentSubMethod: pattern.paymentSubMethod || '', isRecurring: true,
         frequency: pattern.frequency, dueDate: pattern.nextDueDate, duePattern: pattern.duePattern,
         notes: pattern.notes,
         notificationTriggers: pattern.notificationTriggers || []
      });
      setView('add');
   };

   const handleMarkAsPaid = (pattern: RecurringPattern) => {
      if (!currentUser || !currentFamily) return;
      const newTx: Transaction = {
         id: Date.now(), familyId: currentFamily.id, userId: currentUser.id, userName: currentUser.name,
         type: pattern.type, amount: pattern.amount, currency: pattern.currency,
         description: pattern.description, title: pattern.title, category: pattern.category,
         subCategory: pattern.subCategory, paymentMethod: pattern.paymentMethod,
         paymentSubMethod: pattern.paymentSubMethod, notes: "Paid from recurring",
         createdDate: new Date().toISOString()
      };
      setTransactions(prev => [...prev, newTx]);

      // Calculate Next Due Date (Non-destructive override logic)
      const currentDueDate = new Date(pattern.nextDueDate + 'T12:00:00');
      let nextDate = new Date(currentDueDate);

      if (pattern.frequency === 'weekly') {
         nextDate.setDate(nextDate.getDate() + 7);
      } else if (pattern.frequency === 'monthly') {
         // Move to next month
         nextDate.setMonth(nextDate.getMonth() + 1);

         // If logic is fixed and we have a stored dayOfMonth, snap to it
         // This fixes the schedule if the user overrode the current month's date
         if (pattern.duePattern === 'fixed' && pattern.dayOfMonth) {
            // Adjust day to the original anchor
            // Handle month length (e.g. going to Feb)
            const daysInNextMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
            const targetDay = Math.min(pattern.dayOfMonth, daysInNextMonth);
            nextDate.setDate(targetDay);
         }
      } else if (pattern.frequency === 'yearly') {
         nextDate.setFullYear(nextDate.getFullYear() + 1);
      }

      setRecurringPatterns(prev => prev.map(p => p.id === pattern.id ? { ...p, nextDueDate: nextDate.toISOString().split('T')[0] } : p));
   };

   const handleDeletePattern = (id: number) => {
      if (confirm("¿Estás seguro de eliminar esta suscripción recurrente?")) {
         setRecurringPatterns(prev => prev.filter(p => p.id !== id));
      }
   };

   const handleSkipOccurrence = (pattern: RecurringPattern) => {
      if (confirm("¿Saltar el pago de este mes? La fecha se moverá al siguiente periodo.")) {
         // Just advance the date without creating a transaction
         // Logic same as handleMarkAsPaid but without creating newTx
         const currentDueDate = new Date(pattern.nextDueDate + 'T12:00:00');
         let nextDate = new Date(currentDueDate);

         if (pattern.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
         else if (pattern.frequency === 'monthly') {
            nextDate.setMonth(nextDate.getMonth() + 1);
            if (pattern.duePattern === 'fixed' && pattern.dayOfMonth) {
               const daysInNextMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
               nextDate.setDate(Math.min(pattern.dayOfMonth, daysInNextMonth));
            }
         }
         else if (pattern.frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);

         setRecurringPatterns(prev => prev.map(p => p.id === pattern.id ? { ...p, nextDueDate: nextDate.toISOString().split('T')[0] } : p));
      }
   };

   const openCardModal = (cardName: string | null = null, existingConfig: CreditCardConfig | null = null) => {
      // Only admins can manage cards
      if (currentUser?.role !== 'admin') return;

      if (existingConfig) {
         setCardForm(existingConfig);
         setEditingCardName(cardName);
      } else {
         // New or unconfigured
         setCardForm({
            subCategory: cardName || '',
            bankName: '',
            cardNetwork: 'Visa',
            last4: '',
            limit: 0,
            closingDay: 24,
            paymentDueGap: 10,
            color: 'from-gray-700 to-gray-900',
            closingRule: 'fixed'
         });
         setEditingCardName(cardName); // If null, means completely new
      }
      setIsAddingCard(true);
   };

   const handleSaveCard = () => {
      if (!cardForm.subCategory) return alert("El nombre de la tarjeta es requerido");

      const cardName = cardForm.subCategory;
      const isCredit = (paymentMethods['Credit Card'] || []).includes(cardName) || !paymentMethods['Debit Card']?.includes(cardName);
      const methodType = isCredit ? 'Credit Card' : 'Debit Card';

      // 1. Add to payment methods if not exists
      const existingMethods = paymentMethods[methodType] || [];
      // If renaming (and name changed), we might need to handle that, but for now let's assume direct mapping
      if (!existingMethods.includes(cardName)) {
         setPaymentMethods(prev => ({
            ...prev,
            [methodType]: [...existingMethods, cardName]
         }));
      }

      // 2. Add/Update config
      const config: CreditCardConfig = {
         subCategory: cardName,
         bankName: cardForm.bankName || cardName,
         cardNetwork: cardForm.cardNetwork as any || 'Visa',
         last4: cardForm.last4,
         limit: cardForm.limit || 0,
         color: cardForm.color,
         closingRule: cardForm.closingRule as any || 'fixed',
         closingDay: cardForm.closingDay || 1,
         paymentDueGap: cardForm.paymentDueGap || 0
      };

      setCreditCardConfigs(prev => ({
         ...prev,
         [cardName]: config
      }));

      setIsAddingCard(false);
      setEditingCardName(null);
   };

   const deleteUser = (id: number) => {
      if (currentUser?.role !== 'admin') return; // Security check
      if (familyUsers.length <= 1) return alert("Cannot delete last user");
      if (confirm("Delete this user?")) {
         setUsers(u => u.filter(x => x.id !== id));
         if (currentUser?.id === id) handleLogout();
      }
   };

   const handleDeleteCard = () => {
      if (!editingCardName) return;
      if (confirm(`¿Eliminar la tarjeta "${editingCardName}"? Esto no borrará las transacciones históricas, pero quitará la tarjeta de tus métodos de pago.`)) {
         // Remove from config
         const newConfigs = { ...creditCardConfigs };
         delete newConfigs[editingCardName];
         setCreditCardConfigs(newConfigs);

         // Remove from Payment Methods
         const methodType = (paymentMethods['Credit Card'] || []).includes(editingCardName) ? 'Credit Card' : 'Debit Card';
         setPaymentMethods(prev => ({
            ...prev,
            [methodType]: prev[methodType].filter(c => c !== editingCardName)
         }));

         setIsAddingCard(false);
         setEditingCardName(null);
      }
   };

   // --- SETTINGS HANDLERS ---
   const handleAddCategory = () => {
      if (!manageNewItem.trim()) return;
      if (manageCatType === 'expense') {
         if (expenseCategories[manageNewItem]) return alert("Category exists");
         setExpenseCategories(prev => ({ ...prev, [manageNewItem]: [] }));
      } else {
         if (incomeCategories[manageNewItem]) return alert("Category exists");
         setIncomeCategories(prev => ({ ...prev, [manageNewItem]: [] }));
      }
      setManageNewItem('');
   };

   const handleDeleteCategory = (name: string) => {
      if (!confirm(`Delete category "${name}"?`)) return;
      if (manageCatType === 'expense') {
         const newCats = { ...expenseCategories };
         delete newCats[name];
         setExpenseCategories(newCats);
      } else {
         const newCats = { ...incomeCategories };
         delete newCats[name];
         setIncomeCategories(newCats);
      }
   };

   const handleAddSubCategory = () => {
      if (!manageSelectedParent || !manageNewSubItem.trim()) return;
      if (manageCatType === 'expense') {
         const subs = expenseCategories[manageSelectedParent] || [];
         if (subs.includes(manageNewSubItem)) return;
         setExpenseCategories(prev => ({ ...prev, [manageSelectedParent]: [...subs, manageNewSubItem] }));
      } else {
         const subs = incomeCategories[manageSelectedParent] || [];
         if (subs.includes(manageNewSubItem)) return;
         setIncomeCategories(prev => ({ ...prev, [manageSelectedParent]: [...subs, manageNewSubItem] }));
      }
      setManageNewSubItem('');
   };

   const handleDeleteSubCategory = (parent: string, sub: string) => {
      if (!confirm(`Delete sub-category "${sub}"?`)) return;
      if (manageCatType === 'expense') {
         setExpenseCategories(prev => ({ ...prev, [parent]: prev[parent].filter(s => s !== sub) }));
      } else {
         setIncomeCategories(prev => ({ ...prev, [parent]: prev[parent].filter(s => s !== sub) }));
      }
   };

   const handleAddMethod = () => {
      if (!manageNewItem.trim()) return;
      if (paymentMethods[manageNewItem]) return alert("Method exists");
      setPaymentMethods(prev => ({ ...prev, [manageNewItem]: [] }));
      setManageNewItem('');
   };

   const handleDeleteMethod = (name: string) => {
      if (['Cash', 'Debit Card', 'Credit Card'].includes(name)) return alert("Cannot delete system methods");
      if (!confirm(`Delete method "${name}"?`)) return;
      const newMethods = { ...paymentMethods };
      delete newMethods[name];
      setPaymentMethods(newMethods);
   };

   // --- RENDERERS ---

   const renderCards = () => {
      // Fetch both Credit and Debit cards from Payment Methods
      const creditCards = paymentMethods['Credit Card'] || [];
      const debitCards = paymentMethods['Debit Card'] || [];
      const isAdmin = currentUser?.role === 'admin';

      // Merge and map
      const allCardNames = [...creditCards.map(n => ({ name: n, type: 'credit' })), ...debitCards.map(n => ({ name: n, type: 'debit' }))];

      const cards = allCardNames.map(c => {
         // If config exists, use it. If not, use defaults.
         const existingConfig = creditCardConfigs[c.name];
         const config = existingConfig || {
            subCategory: c.name,
            bankName: c.name,
            color: c.type === 'debit' ? 'from-blue-700 to-blue-900' : 'from-slate-700 to-slate-900',
            closingDay: 1,
            paymentDueGap: 0,
            limit: 0,
            closingRule: 'fixed'
         };

         // Calculate Status (Only relevant for credit really, but function handles basics)
         const status = getCardStatus(config as CreditCardConfig, familyTransactions, baseCurrency);
         const limit = config.limit || 0;
         const available = limit - status.currentSpend;
         const progress = limit > 0 ? (status.currentSpend / limit) * 100 : 0;

         return { name: c.name, type: c.type, config, status, limit, available, progress, isConfigured: !!existingConfig };
      });

      return (
         <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-between items-center">
               <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Mis Tarjetas</h2>
                  <p className="text-gray-600 dark:text-gray-400">Gestiona tus tarjetas de crédito y débito.</p>
               </div>
               {isAdmin && (
                  <button onClick={() => openCardModal()} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-blue-600/20">
                     <Plus className="w-5 h-5" /> Nueva Tarjeta
                  </button>
               )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {cards.map((card, idx) => (
                  <div key={idx} className={`rounded-2xl p-6 relative overflow-hidden bg-gradient-to-br ${card.config.color || 'from-slate-800 to-slate-900'} text-white shadow-xl group`}>

                     {/* Edit Button (Visible on Hover) - Only for Admin */}
                     {isAdmin && (
                        <button
                           onClick={() => openCardModal(card.name, card.config as CreditCardConfig)}
                           className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                           <Edit2 className="w-4 h-4 text-white" />
                        </button>
                     )}

                     {/* Header */}
                     <div className="flex justify-between items-start mb-8 pr-10">
                        <div>
                           <p className="font-bold text-lg">{card.config.bankName || card.name}</p>
                           <p className="text-xs uppercase tracking-wider opacity-70">{card.type === 'debit' ? 'Débito' : 'Crédito'}</p>
                        </div>
                        {card.config.cardNetwork === 'Visa' ? <span className="font-bold italic text-2xl opacity-90">VISA</span> :
                           card.config.cardNetwork === 'Mastercard' ? <div className="flex -space-x-2"><div className="w-6 h-6 rounded-full bg-red-500/90" /><div className="w-6 h-6 rounded-full bg-yellow-500/90" /></div> :
                              <span className="font-bold">{card.config.cardNetwork}</span>}
                     </div>

                     {/* Chip & Number */}
                     <div className="flex items-center gap-4 mb-8">
                        <div className="w-10 h-8 rounded bg-yellow-200/20 border border-yellow-200/30 flex items-center justify-center">
                           <div className="w-8 h-6 border border-yellow-200/30 rounded-sm" />
                        </div>
                        <p className="font-mono text-xl tracking-widest">
                           **** **** **** {card.config.last4 || '0000'}
                        </p>
                     </div>

                     {/* Financials / Dates (Only for Credit or Configured Cards) */}
                     {card.type === 'credit' && (
                        <>
                           <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                              <div>
                                 <p className="opacity-60 text-xs uppercase mb-1">Cierra</p>
                                 <p className="font-medium">{card.status.closingDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</p>
                              </div>
                              <div>
                                 <p className="opacity-60 text-xs uppercase mb-1">Vence</p>
                                 <p className="font-medium text-red-200">{card.status.dueDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</p>
                              </div>
                           </div>

                           <div className="space-y-4">
                              <div className="flex justify-between items-end">
                                 <div>
                                    <p className="text-xs opacity-60 mb-1">Consumo Actual</p>
                                    <p className="text-xl font-bold">{formatCurrency(card.status.currentSpend || 0, baseCurrency)}</p>
                                 </div>
                                 {card.limit > 0 && (
                                    <div className="text-right">
                                       <p className="text-xs opacity-60 mb-1">Disponible</p>
                                       <p className="font-medium text-emerald-300">{formatCurrency(card.available || 0, baseCurrency)}</p>
                                    </div>
                                 )}
                              </div>

                              {card.limit > 0 && (
                                 <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                                    <div
                                       className={`h-full rounded-full transition-all duration-1000 ${card.progress > 90 ? 'bg-red-500' : card.progress > 60 ? 'bg-yellow-400' : 'bg-blue-400'
                                          }`}
                                       style={{ width: `${Math.min(card.progress, 100)}%` }}
                                    />
                                 </div>
                              )}

                              {/* Actions */}
                              <div className="flex gap-3 mt-4 pt-4 border-t border-white/10">
                                 <button onClick={() => setView('analytics')} className="flex-1 py-2 text-sm font-medium bg-white/10 hover:bg-white/20 rounded-lg transition-colors">Ver Resumen</button>
                                 <button onClick={() => { setView('add'); setFormData(f => ({ ...f, type: 'expense', paymentMethod: 'Credit Card', paymentSubMethod: card.name, category: 'Credit Card Payment', amount: (card.status.currentSpend || 0).toString() })) }} className="flex-1 py-2 text-sm font-medium bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors shadow-lg shadow-blue-500/30">Pagar</button>
                              </div>
                           </div>
                        </>
                     )}

                     {/* Setup Prompt for Debit or Unconfigured */}
                     {(card.type === 'debit' || !card.isConfigured) && card.type !== 'credit' && isAdmin && (
                        <div className="mt-4 pt-4 border-t border-white/10 text-center">
                           <p className="text-sm opacity-70 italic mb-2">Tarjeta de Débito</p>
                           {!card.isConfigured && <button onClick={() => openCardModal(card.name, null)} className="text-xs underline hover:text-blue-300">Personalizar diseño</button>}
                        </div>
                     )}
                  </div>
               ))}

               {/* Empty State / Add Placeholder */}
               {isAdmin && (
                  <div onClick={() => openCardModal()} className="rounded-2xl p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 hover:text-blue-500 hover:border-blue-500 transition-colors cursor-pointer min-h-[300px]">
                     <Plus className="w-12 h-12 mb-4" />
                     <p className="font-medium">Agregar nueva tarjeta</p>
                  </div>
               )}
            </div>

            {/* Add/Edit Card Modal */}
            {isAddingCard && (
               <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl border dark:border-gray-700">
                     <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{editingCardName && creditCardConfigs[editingCardName] ? 'Editar Tarjeta' : 'Nueva Tarjeta'}</h3>
                        <button onClick={() => setIsAddingCard(false)}><X className="w-5 h-5 text-gray-500 dark:text-gray-400" /></button>
                     </div>

                     <div className="space-y-4">
                        <div>
                           <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-gray-300">Nombre (Identificador)</label>
                           <input
                              placeholder="e.g. Visa Galicia"
                              className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                              value={cardForm.subCategory}
                              onChange={e => setCardForm({ ...cardForm, subCategory: e.target.value })}
                              disabled={!!(editingCardName && creditCardConfigs[editingCardName])} // Disable renaming key for now to avoid data migration complexity
                           />
                           {editingCardName && creditCardConfigs[editingCardName] && <p className="text-[10px] text-gray-500 mt-1">El nombre no se puede cambiar al editar.</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-gray-300">Banco / Emisor</label>
                              <input placeholder="Galicia" className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" value={cardForm.bankName} onChange={e => setCardForm({ ...cardForm, bankName: e.target.value })} />
                           </div>
                           <div>
                              <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-gray-300">Red</label>
                              <select className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" value={cardForm.cardNetwork} onChange={e => setCardForm({ ...cardForm, cardNetwork: e.target.value as any })}>
                                 <option value="Visa">Visa</option>
                                 <option value="Mastercard">Mastercard</option>
                                 <option value="Amex">Amex</option>
                                 <option value="Other">Otro</option>
                              </select>
                           </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-gray-300">Últimos 4</label>
                              <input placeholder="4242" maxLength={4} className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" value={cardForm.last4} onChange={e => setCardForm({ ...cardForm, last4: e.target.value })} />
                           </div>
                           <div>
                              <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-gray-300">Color Tema</label>
                              <select className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" value={cardForm.color} onChange={e => setCardForm({ ...cardForm, color: e.target.value })}>
                                 <option value="from-slate-800 to-slate-900">Negro (Slate)</option>
                                 <option value="from-blue-800 to-blue-900">Azul</option>
                                 <option value="from-purple-800 to-purple-900">Violeta</option>
                                 <option value="from-emerald-800 to-emerald-900">Verde</option>
                                 <option value="from-rose-800 to-rose-900">Rojo</option>
                                 <option value="from-yellow-600 to-yellow-800">Dorado</option>
                              </select>
                           </div>
                        </div>

                        {/* Only show credit fields if it seems to be a credit card (defaults to yes for new) */}
                        <div className="border-t dark:border-gray-700 pt-4 mt-2">
                           <p className="text-xs font-bold mb-3 text-gray-500 uppercase">Configuración de Crédito (Opcional)</p>
                           <div className="grid grid-cols-2 gap-4 mb-4">
                              <div>
                                 <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-gray-300">Límite</label>
                                 <input type="number" placeholder="0" className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" value={cardForm.limit} onChange={e => setCardForm({ ...cardForm, limit: parseFloat(e.target.value) })} />
                              </div>
                              <div>
                                 <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-gray-300">Día Cierre</label>
                                 <input type="number" min="1" max="31" placeholder="24" className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" value={cardForm.closingDay} onChange={e => setCardForm({ ...cardForm, closingDay: parseInt(e.target.value) })} />
                              </div>
                           </div>
                           <div>
                              <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-gray-300">Días al Vencimiento (Gap)</label>
                              <input type="number" placeholder="10" className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600" value={cardForm.paymentDueGap} onChange={e => setCardForm({ ...cardForm, paymentDueGap: parseInt(e.target.value) })} />
                              <p className="text-[10px] text-gray-500 mt-1">Días entre el cierre y el vencimiento de la tarjeta.</p>
                           </div>
                        </div>

                        <div className="flex gap-2 mt-4">
                           <button onClick={handleSaveCard} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">Guardar Tarjeta</button>
                           {editingCardName && (
                              <button onClick={handleDeleteCard} className="px-4 py-3 bg-red-100 text-red-600 font-bold rounded-lg hover:bg-red-200">
                                 <Trash2 className="w-5 h-5" />
                              </button>
                           )}
                        </div>
                     </div>
                  </div>
               </div>
            )}
         </div>
      );
   };

   const renderRecurringManager = () => {
      return (
         <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-between items-center">
               <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Suscripciones</h2>
                  <p className="text-gray-600 dark:text-gray-400">Gestiona tus gastos e ingresos recurrentes.</p>
               </div>
               <button
                  onClick={() => { setView('add'); resetForm(); setFormData(f => ({ ...f, isRecurring: true })); }}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-blue-600/20"
               >
                  <Plus className="w-5 h-5" /> Nueva Regla
               </button>
            </div>

            {familyPatterns.length === 0 ? (
               <div className="p-8 text-center bg-gray-100 dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                  <RefreshCw className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                  <p className="text-gray-500 font-medium">No tienes transacciones recurrentes configuradas.</p>
               </div>
            ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {familyPatterns.map(pattern => (
                     <div key={pattern.id} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 relative group transition-all hover:shadow-md">
                        <div className="flex justify-between items-start mb-3">
                           <div className="flex items-center gap-3">
                              <div className={`p-3 rounded-xl ${pattern.type === 'expense' ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'bg-green-100 text-green-600 dark:bg-green-900/30'}`}>
                                 <RefreshCw className="w-5 h-5" />
                              </div>
                              <div>
                                 <h3 className="font-bold text-gray-900 dark:text-white">{pattern.title}</h3>
                                 <p className="text-xs text-gray-500 capitalize">{pattern.frequency} • Próximo: {new Date(pattern.nextDueDate).toLocaleDateString()}</p>
                              </div>
                           </div>
                           <div className="text-right">
                              <p className={`font-bold text-lg ${pattern.type === 'expense' ? 'text-gray-900 dark:text-white' : 'text-green-600'}`}>
                                 {formatCurrency(pattern.amount, pattern.currency)}
                              </p>
                           </div>
                        </div>

                        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                           <button onClick={() => handleEditPattern(pattern)} className="flex-1 py-2 text-xs font-bold bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg flex items-center justify-center gap-1">
                              <Edit2 className="w-3 h-3" /> Editar / Override
                           </button>
                           <button onClick={() => handleSkipOccurrence(pattern)} className="flex-1 py-2 text-xs font-bold bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg flex items-center justify-center gap-1">
                              <SkipForward className="w-3 h-3" /> Saltar Mes
                           </button>
                           <button onClick={() => handleDeletePattern(pattern.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                              <Trash2 className="w-4 h-4" />
                           </button>
                        </div>

                        {/* Quick Action: Pay Now */}
                        <button
                           onClick={() => handleMarkAsPaid(pattern)}
                           className={`absolute -right-2 -bottom-2 w-10 h-10 rounded-full shadow-lg flex items-center justify-center text-white transition-transform transform active:scale-95 ${pattern.type === 'expense' ? 'bg-blue-600' : 'bg-green-600'}`}
                           title="Registrar Pago Ahora"
                        >
                           <CheckCircle className="w-5 h-5" />
                        </button>
                     </div>
                  ))}
               </div>
            )}
         </div>
      );
   };

   const renderReports = () => {
      // Basic implementation of analytics
      // Filter transactions by analyticsYear
      const yearlyTxs = familyTransactions.filter(t => new Date(t.createdDate).getFullYear() === analyticsYear);

      // Group by Month
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const data = months.map((m, i) => {
         let inc = 0, exp = 0;
         yearlyTxs.forEach(t => {
            const d = new Date(t.createdDate);
            if (d.getMonth() === i) {
               const val = convertAmount(t.amount, t.currency, baseCurrency);
               if (t.type === 'income') inc += val; else exp += val;
            }
         });
         return { name: m, Ingresos: inc, Gastos: exp };
      });

      return (
         <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-between items-center">
               <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Análisis</h2>
               <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1 rounded-lg border dark:border-gray-700">
                  <button onClick={() => setAnalyticsYear(y => y - 1)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><ChevronDown className="w-4 h-4 rotate-90" /></button>
                  <span className="font-bold text-sm px-2 text-gray-900 dark:text-white">{analyticsYear}</span>
                  <button onClick={() => setAnalyticsYear(y => y + 1)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><ChevronRight className="w-4 h-4" /></button>
               </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
               <h3 className="font-bold mb-6 text-gray-900 dark:text-white">Resumen Anual</h3>
               <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={(val) => `$${val}`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff', borderRadius: '8px' }} />
                        <Legend />
                        <Bar dataKey="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                     </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>
         </div>
      );
   };

   const renderAddTransaction = () => {
      // Use categories based on type
      const currentCats = formData.type === 'expense' ? expenseCategories : incomeCategories;
      const catKeys = Object.keys(currentCats);
      const subCats = formData.category ? currentCats[formData.category] || [] : [];

      // Payment methods
      const methodKeys = Object.keys(paymentMethods);
      const methodSubs = formData.paymentMethod ? paymentMethods[formData.paymentMethod] || [] : [];

      return (
         <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border dark:border-gray-700 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
               <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{originalTx ? 'Editar Transacción' : 'Nueva Transacción'}</h2>
               <button onClick={() => setView('dashboard')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"><X className="w-6 h-6 text-gray-500" /></button>
            </div>

            <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl mb-6">
               <button onClick={() => setFormData({ ...formData, type: 'expense' })} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${formData.type === 'expense' ? 'bg-white dark:bg-gray-600 shadow text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>Gasto</button>
               <button onClick={() => setFormData({ ...formData, type: 'income' })} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${formData.type === 'income' ? 'bg-white dark:bg-gray-600 shadow text-green-500' : 'text-gray-500 dark:text-gray-400'}`}>Ingreso</button>
            </div>

            <div className="space-y-4">
               {/* Amount Row */}
               <div className="flex gap-4">
                  <div className="flex-1">
                     <label className="block text-xs font-bold mb-1 text-gray-500 uppercase">Monto</label>
                     <div className="relative">
                        <span className="absolute left-3 top-3 text-gray-400">$</span>
                        <input
                           type="number"
                           className="w-full p-3 pl-7 bg-gray-50 dark:bg-gray-900 border dark:border-gray-600 rounded-lg text-xl font-bold text-gray-900 dark:text-white focus:ring-2 ring-blue-500 outline-none"
                           placeholder="0.00"
                           value={formData.amount}
                           onChange={e => setFormData({ ...formData, amount: e.target.value })}
                           autoFocus
                        />
                     </div>
                  </div>
                  <div className="w-24">
                     <label className="block text-xs font-bold mb-1 text-gray-500 uppercase">Moneda</label>
                     <select
                        className="w-full p-3 bg-gray-50 dark:bg-gray-900 border dark:border-gray-600 rounded-lg font-bold text-gray-900 dark:text-white"
                        value={formData.currency}
                        onChange={e => setFormData({ ...formData, currency: e.target.value })}
                     >
                        {currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                     </select>
                  </div>
               </div>

               {/* Description */}
               <div>
                  <label className="block text-xs font-bold mb-1 text-gray-500 uppercase">Descripción</label>
                  <input
                     className="w-full p-3 bg-gray-50 dark:bg-gray-900 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                     placeholder="¿En qué gastaste?"
                     value={formData.description}
                     onChange={e => setFormData({ ...formData, description: e.target.value })}
                  />
               </div>

               {/* Category & Sub */}
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="block text-xs font-bold mb-1 text-gray-500 uppercase">Categoría</label>
                     <select
                        className="w-full p-3 bg-gray-50 dark:bg-gray-900 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                        value={formData.category}
                        onChange={e => setFormData({ ...formData, category: e.target.value, subCategory: '' })}
                     >
                        {catKeys.map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                  </div>
                  <div>
                     <label className="block text-xs font-bold mb-1 text-gray-500 uppercase">Sub-Categoría</label>
                     <select
                        className="w-full p-3 bg-gray-50 dark:bg-gray-900 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white disabled:opacity-50"
                        value={formData.subCategory}
                        onChange={e => setFormData({ ...formData, subCategory: e.target.value })}
                        disabled={subCats.length === 0}
                     >
                        <option value="">General</option>
                        {subCats.map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                  </div>
               </div>

               {/* Payment Method */}
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="block text-xs font-bold mb-1 text-gray-500 uppercase">Método Pago</label>
                     <select
                        className="w-full p-3 bg-gray-50 dark:bg-gray-900 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                        value={formData.paymentMethod}
                        onChange={e => setFormData({ ...formData, paymentMethod: e.target.value, paymentSubMethod: '' })}
                     >
                        {methodKeys.map(m => <option key={m} value={m}>{m}</option>)}
                     </select>
                  </div>
                  <div>
                     <label className="block text-xs font-bold mb-1 text-gray-500 uppercase">Instrumento</label>
                     <select
                        className="w-full p-3 bg-gray-50 dark:bg-gray-900 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white disabled:opacity-50"
                        value={formData.paymentSubMethod}
                        onChange={e => setFormData({ ...formData, paymentSubMethod: e.target.value })}
                        disabled={methodSubs.length === 0}
                     >
                        <option value="">Seleccionar...</option>
                        {methodSubs.map(m => <option key={m} value={m}>{m}</option>)}
                     </select>
                  </div>
               </div>

               {/* Date */}
               <div>
                  <label className="block text-xs font-bold mb-1 text-gray-500 uppercase">Fecha</label>
                  <input
                     type="date"
                     className="w-full p-3 bg-gray-50 dark:bg-gray-900 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                     value={formData.expirationDate}
                     onChange={e => setFormData({ ...formData, expirationDate: e.target.value })}
                  />
               </div>

               {/* Recurring Toggle */}
               <div className="flex items-center gap-3 pt-2">
                  <button
                     onClick={() => setFormData(f => ({ ...f, isRecurring: !f.isRecurring }))}
                     className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.isRecurring ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                     <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isRecurring ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Es recurrente (Suscripción/Fijo)</span>
               </div>

               {/* Recurring Options */}
               {formData.isRecurring && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl space-y-3 border border-blue-100 dark:border-blue-900/30">
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="block text-xs font-bold mb-1 text-gray-600 dark:text-gray-400">Frecuencia</label>
                           <select className="w-full p-2 rounded border dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={formData.frequency} onChange={e => setFormData({ ...formData, frequency: e.target.value as any })}>
                              <option value="weekly">Semanal</option>
                              <option value="monthly">Mensual</option>
                              <option value="yearly">Anual</option>
                           </select>
                        </div>
                        <div>
                           <label className="block text-xs font-bold mb-1 text-gray-600 dark:text-gray-400">Próximo Vencimiento</label>
                           <input type="date" className="w-full p-2 rounded border dark:border-gray-600 dark:bg-gray-800 dark:text-white" value={formData.dueDate} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} />
                        </div>
                     </div>
                  </div>
               )}

               {/* Installments (Only if Expense & Not Recurring) */}
               {formData.type === 'expense' && !formData.isRecurring && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border dark:border-gray-700">
                     <label className="block text-xs font-bold mb-1 text-gray-500 uppercase">Cuotas</label>
                     <div className="flex items-center gap-4">
                        <input
                           type="range" min="1" max="24"
                           className="flex-1"
                           value={formData.installments}
                           onChange={e => setFormData({ ...formData, installments: parseInt(e.target.value) })}
                        />
                        <span className="text-lg font-bold w-8 text-center text-gray-900 dark:text-white">{formData.installments}</span>
                     </div>
                     {formData.installments > 1 && (
                        <p className="text-xs text-gray-500 mt-1">Se crearán {formData.installments} transacciones futuras. Monto por cuota: {formatCurrency(parseFloat(formData.amount || '0') / formData.installments, formData.currency)}</p>
                     )}
                  </div>
               )}

               <div className="pt-4 flex gap-3">
                  <button onClick={() => setView('dashboard')} className="flex-1 py-3 text-gray-600 dark:text-gray-300 font-bold bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg">Cancelar</button>
                  <button onClick={handleSaveTransaction} className="flex-1 py-3 text-white font-bold bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-600/20">Guardar</button>
               </div>
            </div>
         </div>
      );
   };

   const renderChat = () => {
      // API Key Check
      if (hasApiKey === false) {
         return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
               <div className="p-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-full mb-4">
                  <KeyRound className="w-12 h-12 text-yellow-600 dark:text-yellow-400" />
               </div>
               <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">API Key Requerida</h2>
               <p className="text-gray-600 dark:text-gray-400 max-w-md mb-6">
                  Para usar el asistente inteligente Gemini, necesitas configurar tu propia API Key de Google.
               </p>
               <button
                  onClick={() => getAIStudio().openSelectKey()}
                  className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg"
               >
                  Conectar API Key
               </button>
            </div>
         );
      }

      const handleSend = async () => {
         if (!chatInput.trim() || chatLoading) return;
         const userMsg: ChatMessage = { role: 'user', text: chatInput, timestamp: Date.now() };
         const newHistory = [...chatHistory, userMsg];
         setChatHistory(newHistory);
         setChatInput('');
         setChatLoading(true);

         try {
            // Pass formatted history to service
            // The service expects just text/role but our state has timestamp.
            const responseText = await sendMessageToGemini(userMsg.text, chatHistory);
            const aiMsg: ChatMessage = { role: 'model', text: responseText, timestamp: Date.now() };
            setChatHistory([...newHistory, aiMsg]);
         } catch (error) {
            setChatHistory([...newHistory, { role: 'model', text: 'Lo siento, hubo un error al conectar con Gemini.', timestamp: Date.now() }]);
         } finally {
            setChatLoading(false);
         }
      };

      return (
         <div className="h-[calc(100vh-140px)] flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden animate-in fade-in">
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
               <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-500" />
                  <h3 className="font-bold text-gray-900 dark:text-white">Asistente Financiero</h3>
               </div>
               <button onClick={() => setChatHistory([])} className="text-xs text-gray-500 hover:text-red-500">Borrar Chat</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
               {chatHistory.length === 0 && (
                  <div className="text-center text-gray-400 mt-10">
                     <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-20" />
                     <p className="text-sm">Pregúntame sobre tus gastos, consejos de ahorro o análisis de tus finanzas.</p>
                  </div>
               )}
               {chatHistory.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                     <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none'
                        }`}>
                        {msg.text}
                     </div>
                  </div>
               ))}
               {chatLoading && (
                  <div className="flex justify-start">
                     <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-2xl rounded-bl-none flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                        <span className="text-xs text-gray-500">Pensando...</span>
                     </div>
                  </div>
               )}
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t dark:border-gray-700">
               <div className="flex gap-2">
                  <input
                     className="flex-1 p-3 bg-white dark:bg-gray-900 border dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                     placeholder="Escribe tu consulta..."
                     value={chatInput}
                     onChange={e => setChatInput(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && handleSend()}
                     disabled={chatLoading}
                  />
                  <button
                     onClick={handleSend}
                     disabled={!chatInput.trim() || chatLoading}
                     className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                     <Send className="w-5 h-5" />
                  </button>
               </div>
            </div>
         </div>
      );
   };





   const renderDashboard = () => {
      // 1. Calculate Stats
      const now = new Date();
      const currMonth = now.getMonth();
      const currYear = now.getFullYear();
      const prevDate = new Date();
      prevDate.setMonth(currMonth - 1);
      const prevMonth = prevDate.getMonth();
      const prevYear = prevDate.getFullYear();

      let incomeCurr = 0, expenseCurr = 0;
      let incomePrev = 0, expensePrev = 0;
      let totalBalance = 0;

      familyTransactions.forEach(t => {
         const d = new Date(t.createdDate);
         const amt = convertAmount(t.amount, t.currency, baseCurrency);

         // Total Balance is cumulative
         if (t.type === 'income') totalBalance += amt;
         else totalBalance -= amt;

         if (d.getMonth() === currMonth && d.getFullYear() === currYear) {
            if (t.type === 'income') incomeCurr += amt; else expenseCurr += amt;
         }
         if (d.getMonth() === prevMonth && d.getFullYear() === prevYear) {
            if (t.type === 'income') incomePrev += amt; else expensePrev += amt;
         }
      });

      const calcPct = (curr: number, prev: number) => {
         if (prev === 0) return curr > 0 ? 100 : 0;
         return ((curr - prev) / prev) * 100;
      };

      const incomePct = calcPct(incomeCurr, incomePrev);
      const expensePct = calcPct(expenseCurr, expensePrev);
      // Rough balance trend based on net saved compared to last month
      const balancePct = calcPct((incomeCurr - expenseCurr), (incomePrev - expensePrev));

      // 2. Prepare Chart Data based on dashboardPeriod ('6m', 'ytd', '1y')
      const chartData = [];
      const getChartStartDate = () => {
         const d = new Date();
         if (dashboardPeriod === '6m') d.setMonth(d.getMonth() - 5);
         if (dashboardPeriod === 'ytd') { d.setMonth(0); d.setDate(1); } // Start of year
         if (dashboardPeriod === '1y') d.setMonth(d.getMonth() - 11);
         return d;
      };

      const startDate = getChartStartDate();
      startDate.setDate(1); // Align to month start

      // Generate buckets from startDate to now
      let loopDate = new Date(startDate);
      while (loopDate <= now) {
         const monthLabel = loopDate.toLocaleString('default', { month: 'short' }).toUpperCase();
         let inc = 0, exp = 0;

         familyTransactions.forEach(t => {
            const td = new Date(t.createdDate);
            if (td.getMonth() === loopDate.getMonth() && td.getFullYear() === loopDate.getFullYear()) {
               const val = convertAmount(t.amount, t.currency, baseCurrency);
               if (t.type === 'income') inc += val; else exp += val;
            }
         });
         chartData.push({ name: monthLabel, Income: inc, Expense: exp });

         loopDate.setMonth(loopDate.getMonth() + 1);
      }

      // 3. Prepare Donut Data (Categories)
      const categoryMap: Record<string, number> = {};
      let totalMonthExpense = 0;
      familyTransactions.forEach(t => {
         const td = new Date(t.createdDate);
         if (td.getMonth() === currMonth && td.getFullYear() === currYear && t.type === 'expense') {
            const val = convertAmount(t.amount, t.currency, baseCurrency);
            categoryMap[t.category] = (categoryMap[t.category] || 0) + val;
            totalMonthExpense += val;
         }
      });
      // Top 4 categories + Others
      let pieData = Object.entries(categoryMap)
         .map(([name, value]) => ({ name, value }))
         .sort((a, b) => b.value - a.value);

      if (pieData.length > 4) {
         const others = pieData.slice(4).reduce((sum, item) => sum + item.value, 0);
         pieData = pieData.slice(0, 4);
         pieData.push({ name: 'Others', value: others });
      }
      const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

      // 4. Recent Transactions List (Last 5)
      const recentTxs = [...familyTransactions].sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()).slice(0, 5);

      return (
         <div className="space-y-6 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h2>
               </div>
               <button
                  onClick={() => { setView('add'); resetForm(); }}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold transition-colors shadow-lg shadow-blue-600/20"
               >
                  <Plus className="w-5 h-5" /> Añadir Transacción
               </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               {/* Balance Card */}
               <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                     <Wallet className="w-16 h-16 text-blue-500" />
                  </div>
                  <div className="flex items-start justify-between mb-4">
                     <div>
                        <p className="text-gray-600 dark:text-gray-400 font-medium text-sm">Balance Total</p>
                        <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(totalBalance, baseCurrency)}</h3>
                     </div>
                     <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                        <Wallet className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                     </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm">
                     {balancePct >= 0 ? <TrendingUp className="w-4 h-4 text-green-500" /> : <ArrowDownRight className="w-4 h-4 text-red-500" />}
                     <span className={balancePct >= 0 ? "text-green-500 font-bold" : "text-red-500 font-bold"}>
                        {Math.abs(balancePct).toFixed(1)}%
                     </span>
                     <span className="text-gray-400 ml-1">vs mes anterior</span>
                  </div>
               </div>

               {/* Income Card */}
               <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                     <TrendingUp className="w-16 h-16 text-green-500" />
                  </div>
                  <div className="flex items-start justify-between mb-4">
                     <div>
                        <p className="text-gray-600 dark:text-gray-400 font-medium text-sm">Ingresos (Mes)</p>
                        <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(incomeCurr, baseCurrency)}</h3>
                     </div>
                     <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg">
                        <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                     </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm">
                     {incomePct >= 0 ? <ArrowUpRight className="w-4 h-4 text-green-500" /> : <ArrowDownRight className="w-4 h-4 text-red-500" />}
                     <span className={incomePct >= 0 ? "text-green-500 font-bold" : "text-red-500 font-bold"}>
                        {Math.abs(incomePct).toFixed(1)}%
                     </span>
                     <span className="text-gray-400 ml-1">vs mes anterior</span>
                  </div>
               </div>

               {/* Expense Card */}
               <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                     <ShoppingBag className="w-16 h-16 text-red-500" />
                  </div>
                  <div className="flex items-start justify-between mb-4">
                     <div>
                        <p className="text-gray-600 dark:text-gray-400 font-medium text-sm">Gastos (Mes)</p>
                        <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(expenseCurr, baseCurrency)}</h3>
                     </div>
                     <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-lg">
                        <ShoppingBag className="w-6 h-6 text-red-600 dark:text-red-400" />
                     </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm">
                     {expensePct > 0 ? <ArrowUpRight className="w-4 h-4 text-red-500" /> : <ArrowDownRight className="w-4 h-4 text-green-500" />}
                     <span className={expensePct > 0 ? "text-red-500 font-bold" : "text-green-500 font-bold"}>
                        {Math.abs(expensePct).toFixed(1)}%
                     </span>
                     <span className="text-gray-400 ml-1">vs mes anterior</span>
                  </div>
               </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
               {/* Main Chart */}
               <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="flex justify-between items-center mb-6">
                     <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Flujo de Caja</h3>
                        <p className="text-sm text-gray-500">Ingresos vs Gastos</p>
                     </div>
                     <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 text-xs font-medium">
                        <button onClick={() => setDashboardPeriod('6m')} className={`px-3 py-1 rounded transition-colors ${dashboardPeriod === '6m' ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>6 Meses</button>
                        <button onClick={() => setDashboardPeriod('ytd')} className={`px-3 py-1 rounded transition-colors ${dashboardPeriod === 'ytd' ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>YTD</button>
                        <button onClick={() => setDashboardPeriod('1y')} className={`px-3 py-1 rounded transition-colors ${dashboardPeriod === '1y' ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>1 Año</button>
                     </div>
                  </div>
                  <div className="h-[300px] w-full">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} barGap={8}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} />
                           <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} dy={10} />
                           <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={(val) => `$${val / 1000}k`} />
                           <Tooltip
                              contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff', borderRadius: '8px' }}
                              itemStyle={{ color: '#fff' }}
                           />
                           <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                           <Bar dataKey="Expense" fill="#64748b" radius={[4, 4, 0, 0]} barSize={20} />
                        </BarChart>
                     </ResponsiveContainer>
                  </div>
               </div>

               {/* Donut Chart */}
               <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Gastos por Categoría</h3>
                  <p className="text-sm text-gray-500 mb-6">Distribución de {now.toLocaleString('default', { month: 'long' })}</p>

                  <div className="h-[220px] w-full relative">
                     <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                           <Pie
                              data={pieData}
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                              stroke="none"
                           >
                              {pieData.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                              ))}
                           </Pie>
                        </PieChart>
                     </ResponsiveContainer>
                     {/* Center Text */}
                     <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-xs text-gray-500">Total Gastado</span>
                        <span className="text-xl font-bold text-gray-900 dark:text-white">
                           ${totalMonthExpense > 1000 ? (totalMonthExpense / 1000).toFixed(1) + 'k' : totalMonthExpense.toFixed(0)}
                        </span>
                     </div>
                  </div>

                  <div className="mt-6 space-y-3">
                     {pieData.slice(0, 3).map((entry, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                           <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                              <span className="text-gray-700 dark:text-gray-300">{entry.name}</span>
                           </div>
                           <span className="font-bold text-gray-900 dark:text-white">
                              {((entry.value / totalMonthExpense) * 100).toFixed(0)}%
                           </span>
                        </div>
                     ))}
                  </div>
               </div>
            </div>

            {/* Recent Transactions List */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Últimos Movimientos</h3>
                  <button
                     onClick={() => setView('analytics')}
                     className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                     Ver todo
                  </button>
               </div>

               <div className="space-y-4">
                  {recentTxs.map(t => {
                     const isToday = new Date(t.createdDate).toDateString() === new Date().toDateString();
                     const dateLabel = isToday
                        ? `Hoy, ${new Date(t.createdDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : new Date(t.createdDate).toLocaleDateString();

                     return (
                        <div key={t.id} className="flex items-center justify-between group hover:bg-gray-50 dark:hover:bg-gray-700/50 p-2 rounded-lg transition-colors -mx-2 cursor-pointer" onClick={() => handleEditTransaction(t)}>
                           <div className="flex items-center gap-4">
                              <div className={`p-3 rounded-full ${t.category === 'Food' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30' :
                                 t.category === 'Utilities' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' :
                                    t.type === 'income' ? 'bg-green-100 text-green-600 dark:bg-green-900/30' :
                                       'bg-gray-100 text-gray-600 dark:bg-gray-700'
                                 }`}>
                                 {t.category === 'Food' ? <ShoppingBag className="w-5 h-5" /> :
                                    t.category === 'Utilities' ? <Zap className="w-5 h-5" /> :
                                       t.type === 'income' ? <TrendingUp className="w-5 h-5" /> :
                                          <Tag className="w-5 h-5" />}
                              </div>
                              <div>
                                 <p className="font-bold text-gray-900 dark:text-white">{t.title || t.description}</p>
                                 <p className="text-xs text-gray-500">{t.paymentMethod} • **** {t.id.toString().slice(-4)}</p>
                              </div>
                           </div>

                           <div className="flex items-center gap-8">
                              <div className="hidden md:block">
                                 <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                    {t.category}
                                 </span>
                              </div>
                              <div className="text-right">
                                 <p className="text-sm text-gray-500 mb-0.5">{dateLabel}</p>
                                 <p className={`font-bold ${t.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                                    {t.type === 'expense' ? '-' : '+'}{formatCurrency(t.amount, t.currency)}
                                 </p>
                              </div>
                           </div>
                        </div>
                     )
                  })}
               </div>
            </div>

         </div>
      );
   };

   const renderSettings = () => {
      const isAdmin = currentUser?.role === 'admin';

      if (settingsSection === 'categories') {
         const currentCats = manageCatType === 'expense' ? expenseCategories : incomeCategories;
         return (
            <div className="space-y-6 animate-in fade-in">
               <div className="flex items-center gap-4">
                  <button onClick={() => setSettingsSection(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                     <ChevronDown className="w-6 h-6 rotate-90" />
                  </button>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Gestionar Categorías</h2>
               </div>

               <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
                  <button onClick={() => setManageCatType('expense')} className={`flex-1 py-2 rounded-lg font-bold transition-colors ${manageCatType === 'expense' ? 'bg-white dark:bg-gray-600 shadow text-red-500' : 'text-gray-500'}`}>Gastos</button>
                  <button onClick={() => setManageCatType('income')} className={`flex-1 py-2 rounded-lg font-bold transition-colors ${manageCatType === 'income' ? 'bg-white dark:bg-gray-600 shadow text-green-500' : 'text-gray-500'}`}>Ingresos</button>
               </div>

               <div className="space-y-4">
                  {/* Add New Category */}
                  <div className="flex gap-2">
                     <input
                        placeholder="Nueva Categoría..."
                        className="flex-1 p-3 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg"
                        value={manageNewItem}
                        onChange={e => setManageNewItem(e.target.value)}
                     />
                     <button onClick={handleAddCategory} className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700"><Plus className="w-5 h-5" /></button>
                  </div>

                  {Object.entries(currentCats).map(([cat, subs]: [string, string[]]) => (
                     <div key={cat} className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden">
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50">
                           <button onClick={() => setManageSelectedParent(manageSelectedParent === cat ? null : cat)} className="font-bold flex items-center gap-2 flex-1">
                              {cat}
                              <ChevronDown className={`w-4 h-4 transition-transform ${manageSelectedParent === cat ? 'rotate-180' : ''}`} />
                              <span className="text-xs font-normal text-gray-500">({subs.length} sub-cat)</span>
                           </button>
                           <button onClick={() => handleDeleteCategory(cat)} className="text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 className="w-4 h-4" /></button>
                        </div>

                        {manageSelectedParent === cat && (
                           <div className="p-4 border-t dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                              <div className="space-y-2 mb-4">
                                 {subs.map(sub => (
                                    <div key={sub} className="flex justify-between items-center pl-4 border-l-2 border-gray-200 dark:border-gray-600">
                                       <span className="text-sm">{sub}</span>
                                       <button onClick={() => handleDeleteSubCategory(cat, sub)} className="text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>
                                    </div>
                                 ))}
                              </div>
                              <div className="flex gap-2">
                                 <input
                                    placeholder="Nueva Sub-categoría"
                                    className="flex-1 p-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600"
                                    value={manageNewSubItem}
                                    onChange={e => setManageNewSubItem(e.target.value)}
                                 />
                                 <button onClick={handleAddSubCategory} className="bg-green-600 text-white px-3 rounded hover:bg-green-700"><Plus className="w-4 h-4" /></button>
                              </div>
                           </div>
                        )}
                     </div>
                  ))}
               </div>
            </div>
         );
      }

      if (settingsSection === 'methods') {
         return (
            <div className="space-y-6 animate-in fade-in">
               <div className="flex items-center gap-4">
                  <button onClick={() => setSettingsSection(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                     <ChevronDown className="w-6 h-6 rotate-90" />
                  </button>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Métodos de Pago</h2>
               </div>

               <div className="space-y-4">
                  <div className="flex gap-2">
                     <input
                        placeholder="Nuevo Método..."
                        className="flex-1 p-3 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg"
                        value={manageNewItem}
                        onChange={e => setManageNewItem(e.target.value)}
                     />
                     <button onClick={handleAddMethod} className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700"><Plus className="w-5 h-5" /></button>
                  </div>

                  <div className="grid gap-3">
                     {Object.keys(paymentMethods).map(method => (
                        <div key={method} className="bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700 flex justify-between items-center">
                           <span className="font-bold">{method}</span>
                           {!['Cash', 'Debit Card', 'Credit Card'].includes(method) && (
                              <button onClick={() => handleDeleteMethod(method)} className="text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 className="w-4 h-4" /></button>
                           )}
                           {['Cash', 'Debit Card', 'Credit Card'].includes(method) && (
                              <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-500">System</span>
                           )}
                        </div>
                     ))}
                  </div>
               </div>
            </div>
         );
      }

      return (
         <div className="space-y-6 animate-in fade-in">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Configuración</h2>

            {/* Data Management */}
            {isAdmin && (
               <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                  <h3 className="font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-white"><Layers className="w-5 h-5 text-purple-500" /> Gestión de Datos</h3>
                  <div className="space-y-3">
                     <button onClick={() => setSettingsSection('categories')} className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                        <span className="font-medium flex items-center gap-2"><Tag className="w-4 h-4" /> Categorías y Subcategorías</span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                     </button>
                     <button onClick={() => setSettingsSection('methods')} className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                        <span className="font-medium flex items-center gap-2"><CreditCardIcon className="w-4 h-4" /> Métodos de Pago</span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                     </button>
                  </div>
               </div>
            )}

            {/* User Profile */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
               <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold flex items-center gap-2 text-gray-900 dark:text-white"><UserIcon className="w-5 h-5 text-blue-500" /> Mi Perfil</h3>
                  {!isEditingProfile && (
                     <button onClick={handleEditProfile} className="text-blue-600 dark:text-blue-400 text-sm font-bold flex items-center gap-1">
                        <Edit2 className="w-4 h-4" /> Editar
                     </button>
                  )}
               </div>

               {!isEditingProfile ? (
                  <div className="space-y-3">
                     <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                           {currentUser?.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                           <p className="font-bold text-gray-900 dark:text-white text-lg flex items-center gap-2">
                              {currentUser?.name}
                              <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${currentUser?.role === 'admin' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                                 {currentUser?.role === 'admin' ? 'Administrador' : 'Miembro'}
                              </span>
                           </p>
                           <p className="text-sm text-gray-500">{currentUser?.email}</p>
                        </div>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm">
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                           <p className="text-xs text-gray-500 uppercase mb-1 flex items-center gap-1"><Phone className="w-3 h-3" /> Teléfono</p>
                           <p className="font-medium text-gray-900 dark:text-white">{currentUser?.phoneNumber || 'No configurado'}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                           <p className="text-xs text-gray-500 uppercase mb-1 flex items-center gap-1"><Bell className="w-3 h-3" /> Notificaciones</p>
                           <p className="font-medium text-gray-900 dark:text-white uppercase">{currentUser?.notificationMethod || 'EMAIL'}</p>
                        </div>
                     </div>
                  </div>
               ) : (
                  <div className="space-y-4 animate-in fade-in">
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Nombre</label>
                           <input
                              className="w-full p-2 bg-gray-50 dark:bg-gray-900 rounded-lg border dark:border-gray-600 text-gray-900 dark:text-white"
                              value={profileForm.firstName || ''}
                              onChange={e => setProfileForm({ ...profileForm, firstName: e.target.value })}
                           />
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Apellido</label>
                           <input
                              className="w-full p-2 bg-gray-50 dark:bg-gray-900 rounded-lg border dark:border-gray-600 text-gray-900 dark:text-white"
                              value={profileForm.lastName || ''}
                              onChange={e => setProfileForm({ ...profileForm, lastName: e.target.value })}
                           />
                        </div>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Email</label>
                        <input
                           className="w-full p-2 bg-gray-50 dark:bg-gray-900 rounded-lg border dark:border-gray-600 text-gray-900 dark:text-white"
                           value={profileForm.email}
                           onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Teléfono (WhatsApp/SMS)</label>
                        <input
                           className="w-full p-2 bg-gray-50 dark:bg-gray-900 rounded-lg border dark:border-gray-600 text-gray-900 dark:text-white"
                           value={profileForm.phoneNumber}
                           placeholder="+54911..."
                           onChange={e => setProfileForm({ ...profileForm, phoneNumber: e.target.value })}
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Preferencia Notificaciones</label>
                        <select
                           className="w-full p-2 bg-gray-50 dark:bg-gray-900 rounded-lg border dark:border-gray-600 text-gray-900 dark:text-white"
                           value={profileForm.notificationMethod}
                           onChange={e => setProfileForm({ ...profileForm, notificationMethod: e.target.value as any })}
                        >
                           <option value="email">Solo Email</option>
                           <option value="whatsapp">Solo WhatsApp</option>
                           <option value="sms">Solo SMS</option>
                           <option value="both">Email + WhatsApp</option>
                        </select>
                     </div>
                     <div className="flex gap-2 pt-2">
                        <button onClick={handleSaveProfile} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700">Guardar</button>
                        <button onClick={() => setIsEditingProfile(false)} className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 py-2 rounded-lg font-bold">Cancelar</button>
                     </div>
                  </div>
               )}
            </div>

            {/* Family Info */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
               <h3 className="font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-white"><Home className="w-5 h-5 text-blue-500" /> Familia</h3>
               <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg mb-4">
                  <div>
                     <p className="text-xs text-gray-500 uppercase">Nombre</p>
                     {isAdmin ? (
                        <input
                           className="font-bold text-gray-900 dark:text-white bg-transparent border-b border-dashed border-gray-400 focus:outline-none focus:border-blue-500"
                           value={currentFamily?.name}
                           onChange={e => {
                              // Direct update for simplicity, in real app needs proper save
                              if (currentFamily) {
                                 const updated = { ...currentFamily, name: e.target.value };
                                 setCurrentFamily(updated);
                                 setFamilies(prev => prev.map(f => f.id === updated.id ? updated : f));
                              }
                           }}
                        />
                     ) : (
                        <p className="font-bold text-gray-900 dark:text-white">{currentFamily?.name}</p>
                     )}
                  </div>
                  <div className="text-right">
                     <p className="text-xs text-gray-500 uppercase">Código de Unión</p>
                     <p className="font-mono text-xl font-bold tracking-widest text-blue-600 dark:text-blue-400">{currentFamily?.joinCode}</p>
                  </div>
               </div>

               <h4 className="font-bold text-sm mb-3 text-gray-900 dark:text-white">Usuarios del Grupo</h4>
               <div className="space-y-2">
                  {familyUsers.map(u => (
                     <div key={u.id} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center font-bold text-xs text-gray-900 dark:text-white">
                              {u.name.substring(0, 2).toUpperCase()}
                           </div>
                           <div>
                              <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                 {u.name} {u.id === currentUser?.id && '(Tú)'}
                                 {u.role === 'admin' && <Crown className="w-3 h-3 text-yellow-500" />}
                              </p>
                              <p className="text-xs text-gray-500">{u.email}</p>
                           </div>
                        </div>

                        {/* Role Management (Only Visible to Admins, can't edit self here) */}
                        {isAdmin && u.id !== currentUser?.id && (
                           <select
                              className="text-xs bg-white dark:bg-gray-800 border dark:border-gray-600 rounded px-2 py-1 text-gray-700 dark:text-gray-300 outline-none focus:ring-1 focus:ring-blue-500"
                              value={u.role || 'member'}
                              onChange={(e) => handleUpdateUserRole(u.id, e.target.value as any)}
                           >
                              <option value="member">Miembro</option>
                              <option value="admin">Admin</option>
                           </select>
                        )}
                        {/* Display Mode for non-admins or self */}
                        {(!isAdmin || u.id === currentUser?.id) && (
                           <span className="text-xs text-gray-400 capitalize bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                              {u.role === 'admin' ? 'Admin' : 'Miembro'}
                           </span>
                        )}

                        {/* User Delete Button */}
                        {isAdmin && u.id !== currentUser?.id && (
                           <button onClick={() => deleteUser(u.id)} className="text-gray-400 hover:text-red-500 p-1">
                              <X className="w-4 h-4" />
                           </button>
                        )}
                     </div>
                  ))}
               </div>
            </div>

            {/* Preferences */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
               <h3 className="font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-white"><SettingsIcon className="w-5 h-5 text-gray-500" /> Preferencias</h3>

               <div className="flex items-center justify-between py-3 border-b dark:border-gray-700">
                  <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                     {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                     <span>Tema Oscuro</span>
                  </div>
                  <button
                     onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
                     className={`w-12 h-6 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-blue-600' : 'bg-gray-300'}`}
                  >
                     <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${theme === 'dark' ? 'left-7' : 'left-1'}`} />
                  </button>
               </div>

               <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                     <DollarSign className="w-5 h-5" />
                     <span>Moneda Base</span>
                  </div>
                  <select
                     className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg text-sm font-bold outline-none text-gray-900 dark:text-white"
                     value={baseCurrency}
                     onChange={e => setBaseCurrency(e.target.value)}
                  >
                     {currencies.map(c => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
                  </select>
               </div>
            </div>

            <div className="pt-4 text-center">
               <button onClick={handleLogout} className="text-red-500 font-bold hover:underline flex items-center justify-center gap-2 w-full py-2">
                  <LogOut className="w-4 h-4" /> Cerrar Sesión
               </button>
            </div>
         </div>
      );
   };

   // --- MAIN RENDER ---

   if (authLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>;

   if (!session) {
      return (
         <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="w-full max-w-md bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
               {showRegister ? <Register /> : <Login />}
               <div className="mt-4 text-center">
                  <button
                     onClick={() => setShowRegister(!showRegister)}
                     className="text-blue-500 hover:underline"
                  >
                     {showRegister ? 'Already have an account? Login' : 'Need an account? Register'}
                  </button>
               </div>
            </div>
         </div>
      );
   }

   if (!currentFamily) {
      return (
         <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
            <div className="w-full max-w-md">
               <h2 className="text-2xl font-bold mb-4 text-center dark:text-white">Select Family</h2>
               <FamilyManager onSelectFamily={onFamilySelected} />
               <div className="mt-4 text-center">
                  <button onClick={handleLogout} className="text-red-500">Sign Out</button>
               </div>
            </div>
         </div>
      );
   }

   return (
      <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'dark bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'} font-sans`}>
         {/* Mobile Header */}
         <div className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b dark:border-gray-700 sticky top-0 z-20">
            <div className="flex items-center gap-2">
               <div className="p-2 bg-blue-600 rounded-lg"><Wallet className="w-5 h-5 text-white" /></div>
               <h1 className="font-bold text-lg text-gray-900 dark:text-white">FlusApp</h1>
            </div>
            <div className="flex items-center gap-3">
               <button onClick={() => setView('chat')} className="p-2 text-gray-600 dark:text-gray-300"><Sparkles className="w-5 h-5" /></button>
               <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {currentUser?.name.substring(0, 2).toUpperCase()}
               </div>
            </div>
         </div>

         <div className="flex">
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 bg-white dark:bg-gray-800 border-r dark:border-gray-700 p-6">
               <div className="flex items-center gap-3 mb-10">
                  <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-600/20"><Wallet className="w-6 h-6 text-white" /></div>
                  <div>
                     <h1 className="font-bold text-xl tracking-tight text-gray-900 dark:text-white">FlusApp</h1>
                     <p className="text-xs text-gray-500">v4.1</p>
                  </div>
               </div>

               <nav className="space-y-2 flex-1">
                  {[
                     { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
                     { id: 'analytics', icon: PieChartIcon, label: 'Analytics' },
                     { id: 'recurring', icon: RefreshCw, label: 'Recurring' },
                     { id: 'cards', icon: CreditCard, label: 'Cards' },
                     { id: 'chat', icon: Sparkles, label: 'AI Assistant' },
                     { id: 'settings', icon: SettingsIcon, label: 'Settings' },
                  ].map(item => (
                     <button
                        key={item.id}
                        onClick={() => setView(item.id as View)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${view === item.id ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-bold' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                     >
                        <item.icon className="w-5 h-5" />
                        {item.label}
                     </button>
                  ))}
               </nav>

               {/* User Profile Footer */}
               <div className="mt-auto pt-6 border-t dark:border-gray-700">
                  <div className="flex items-center gap-3 mb-4">
                     <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                        {currentUser?.name.substring(0, 2).toUpperCase()}
                     </div>
                     <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate text-gray-900 dark:text-white">{currentUser?.name}</p>
                        <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                           {currentFamily?.name}
                           {currentUser?.role === 'admin' && <Crown className="w-3 h-3 text-yellow-500" />}
                        </p>
                     </div>
                     <button onClick={handleLogout} className="text-gray-400 hover:text-red-500"><LogOut className="w-5 h-5" /></button>
                  </div>
                  <button onClick={() => { setView('add'); resetForm(); }} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2">
                     <Plus className="w-5 h-5" /> New Transaction
                  </button>
               </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 min-w-0 max-w-7xl mx-auto p-4 md:p-8 pb-24 md:pb-8">
               {view === 'dashboard' && renderDashboard()}
               {view === 'analytics' && renderReports()}
               {view === 'cards' && renderCards()}
               {view === 'recurring' && renderRecurringManager()}
               {view === 'add' && renderAddTransaction()}
               {view === 'chat' && renderChat()}
               {view === 'settings' && renderSettings()}
            </main>
         </div>

         {/* Mobile Bottom Nav */}
         <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t dark:border-gray-700 pb-safe z-30">
            <div className="flex justify-around items-center p-2">
               {[
                  { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
                  { id: 'analytics', icon: PieChartIcon, label: 'Analytics' },
                  { id: 'add', icon: Plus, label: 'Add', primary: true },
                  { id: 'recurring', icon: RefreshCw, label: 'Subs' },
                  { id: 'settings', icon: SettingsIcon, label: 'Menu' },
               ].map(item => (
                  item.primary ? (
                     <button
                        key={item.id}
                        onClick={() => { setView('add'); resetForm(); }}
                        className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-600/30 -mt-6 border-4 border-gray-50 dark:border-gray-900"
                     >
                        <Plus className="w-6 h-6" />
                     </button>
                  ) : (
                     <button
                        key={item.id}
                        onClick={() => setView(item.id as View)}
                        className={`flex flex-col items-center gap-1 p-2 ${view === item.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}
                     >
                        <item.icon className="w-6 h-6" />
                        <span className="text-[10px] font-medium">{item.label}</span>
                     </button>
                  )
               ))}
            </div>
         </div>
      </div>
   );
}