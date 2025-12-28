
export interface Family {
  id: number | string;
  name: string;
  createdDate: string;
}

export interface Transaction {
  id: number | string;
  familyId: number | string; // Linked to family
  userId: number | string;
  userName: string;
  type: 'income' | 'expense';
  amount: number;
  currency: string; // ISO code (USD, EUR, etc.)
  description: string;
  title?: string;
  category: string;
  subCategory?: string;
  paymentMethod: string;
  paymentSubMethod?: string; // New field for specific instrument (e.g. "Visa Gold")
  notes: string;
  createdDate: string;
  // Cuotas / Installments
  installmentCurrent?: number;
  installmentTotal?: number;
  parentId?: number; // Links split installments together
}

export interface NotificationTrigger {
  id: string;
  days: number; // Number of days
  direction: 'before' | 'after' | 'on_day';
  target: 'due_date' | 'closing_date';
}

export interface RecurringPattern {
  id: number | string;
  familyId: number | string; // Linked to family
  userId: number | string;
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  description: string;
  title: string;
  category: string;
  subCategory?: string;
  paymentMethod: string;
  paymentSubMethod?: string; // New field
  frequency: 'weekly' | 'monthly' | 'yearly';
  nextDueDate: string;
  duePattern: 'fixed' | 'relative' | 'last_workday';
  daysBeforeMonth?: number;
  dayOfMonth?: number; // The "anchor" day for fixed monthly schedules
  cycleClosingDay?: number; // Legacy field, kept for migration
  notes: string;
  notificationTriggers?: NotificationTrigger[]; // New flexible notification config
}

export interface CreditCardDateOverride {
  id: number;
  year: number;
  month: number; // 0-11
  closingDate: string; // ISO YYYY-MM-DD
  dueDate: string; // ISO YYYY-MM-DD
}

export interface CreditCardConfig {
  subCategory: string; // matches the paymentSubMethod e.g. "Visa Gold"
  closingRule: 'fixed' | 'last_business_day';
  closingDay: number; // Used if rule is 'fixed' (1-31)
  paymentDueGap: number; // Days after closing (e.g. 11 for ARG, 21 for US)
  overrides?: CreditCardDateOverride[];
  // New UI fields
  bankName?: string;
  cardNetwork?: 'Visa' | 'Mastercard' | 'Amex' | 'Other';
  last4?: string;
  limit?: number; // Credit Limit
  color?: string; // Visual theme hint
}

export interface User {
  id: number | string;
  familyId?: number | string; // Users belong to a family
  name: string;
  email: string;
  pin?: string; // For simple login
  phoneNumber?: string;
  notificationMethod: 'email' | 'whatsapp' | 'sms' | 'both';
  firstName?: string; // New split field
  lastName?: string; // New split field
  role?: 'admin' | 'member'; // Permission level
}

export type View = 'dashboard' | 'add' | 'analytics' | 'settings' | 'chat' | 'cards' | 'recurring';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}