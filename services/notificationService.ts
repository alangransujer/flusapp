
import { User, Transaction, RecurringPattern, CreditCardConfig, NotificationTrigger } from '../types';

// Request permission for browser notifications
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return;
  
  if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
    await Notification.requestPermission();
  }
};

// Trigger a local system notification (Browser Push)
export const sendSystemNotification = (title: string, body: string) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { 
        body, 
        icon: 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png', // Generic user icon
        silent: false
      });
    } catch (e) {
      console.warn('Notification failed', e);
    }
  }
};

// Send via Email Client
export const sendEmail = (user: User, subject: string, body: string) => {
  if (!user.email) return false;
  const link = `mailto:${user.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(link, '_blank');
  return true;
};

// Send via WhatsApp Web/App
export const sendWhatsApp = (user: User, message: string) => {
  if (!user.phoneNumber) return false;
  const phone = user.phoneNumber.replace(/\D/g, ''); // Strip non-digits
  const link = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(link, '_blank');
  return true;
};

// Send via SMS App
export const sendSMS = (user: User, message: string) => {
  if (!user.phoneNumber) return false;
  const phone = user.phoneNumber.replace(/\D/g, '');
  const link = `sms:${phone}?body=${encodeURIComponent(message)}`;
  window.open(link, '_self'); // Same window for SMS protocols usually works best
  return true;
};

// Orchestrator for Manual Notifications
export const notifyUserManual = (user: User, subject: string, message: string) => {
  let sent = false;
  const method = user.notificationMethod;

  // Primary methods
  if (method === 'email' || method === 'both') {
    if (sendEmail(user, subject, message)) sent = true;
  }
  
  // Secondary methods (delay slightly if 'both' to avoid browser blocking multiple popups)
  if (method === 'whatsapp' || method === 'both') {
     setTimeout(() => {
        if (sendWhatsApp(user, `${subject}: ${message}`)) sent = true;
     }, method === 'both' ? 800 : 0);
  } else if (method === 'sms') {
     if (sendSMS(user, `${subject}: ${message}`)) sent = true;
  }

  if (!sent) {
    alert(`Could not send notification. Please check if ${user.name} has a valid email or phone number configured in Settings.`);
  }
  return sent;
};

// --- DATE LOGIC HELPERS ---

const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

const adjustToBusinessDay = (date: Date): Date => {
  const d = new Date(date);
  // If Sat(6), -1 to Fri. If Sun(0), -2 to Fri.
  if (d.getDay() === 6) d.setDate(d.getDate() - 1);
  else if (d.getDay() === 0) d.setDate(d.getDate() - 2);
  return d;
};

const getLastBusinessDayOfMonth = (year: number, month: number): Date => {
  const lastDay = new Date(year, month + 1, 0); // Last day of month
  return adjustToBusinessDay(lastDay);
};

// Calculate Closing Date and Due Date based on config
export const calculateCardDates = (config: CreditCardConfig, refDate: Date) => {
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  
  // 1. Check for Manual Overrides first
  if (config.overrides && config.overrides.length > 0) {
    const override = config.overrides.find(o => o.year === year && o.month === month);
    if (override) {
      // Use override dates (Append time to ensure local date parsing avoids timezone shift if standard format)
      return {
        closingDate: new Date(override.closingDate + 'T12:00:00'),
        dueDate: new Date(override.dueDate + 'T12:00:00')
      };
    }
  }

  // 2. Standard Rule Calculation
  let closingDate: Date;
  
  if (config.closingRule === 'last_business_day') {
    closingDate = getLastBusinessDayOfMonth(year, month);
  } else {
    // Fixed day (e.g. 25th)
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    // Clamp to valid day (e.g. Feb 30 -> Feb 28)
    const day = Math.min(config.closingDay, lastDayOfMonth);
    
    let rawClosing = new Date(year, month, day);
    // Apply Business Logic (Shift to Friday if weekend)
    closingDate = adjustToBusinessDay(rawClosing);
  }

  // Calculate Due Date: Closing + Gap
  const dueDate = new Date(closingDate);
  dueDate.setDate(dueDate.getDate() + config.paymentDueGap);

  return { closingDate, dueDate };
};

// Get Status of a specific card for Dashboard Widget
export const getCardStatus = (
  config: CreditCardConfig, 
  transactions: Transaction[],
  currency: string
) => {
  const today = new Date();
  today.setHours(0,0,0,0);
  
  // 1. Find the closing date for the current month context
  let { closingDate, dueDate } = calculateCardDates(config, today);
  
  // 2. If today is past this month's closing, the active cycle is actually next month's statement
  // e.g. Closes Jan 25. Today Jan 26. Active cycle closes Feb 25.
  if (today > closingDate) {
    const nextMonth = new Date(today);
    nextMonth.setDate(15); // Safety mid-month
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextDates = calculateCardDates(config, nextMonth);
    closingDate = nextDates.closingDate;
    dueDate = nextDates.dueDate;
  }
  
  // 3. Find Start Date (Previous closing + 1 day)
  // Go back ~1 month from the active closing date to find the previous closing
  const prevMonth = new Date(closingDate);
  prevMonth.setDate(15); 
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  const { closingDate: prevClosing } = calculateCardDates(config, prevMonth);
  
  const cycleStart = new Date(prevClosing);
  cycleStart.setDate(cycleStart.getDate() + 1);
  cycleStart.setHours(0,0,0,0);
  
  // 4. Sum Spend
  const currentSpend = transactions
    .filter(t => 
      t.type === 'expense' &&
      t.currency === currency &&
      t.paymentSubMethod === config.subCategory &&
      new Date(t.createdDate) >= cycleStart &&
      new Date(t.createdDate) <= closingDate
    )
    .reduce((sum, t) => sum + t.amount, 0);

  // Calculate days remaining
  const daysToClose = Math.ceil((closingDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

  return {
    cycleStart,
    closingDate,
    dueDate,
    currentSpend,
    daysToClose
  };
};

// Automation: Check for due items and notify
// Uses sessionStorage to prevent spamming notifications on every reload
const NOTIFIED_KEY = 'notified_transactions_session';

export const checkAndNotifyDueItems = (
  patterns: RecurringPattern[], 
  users: User[], 
  history: Transaction[],
  cardConfigs: Record<string, CreditCardConfig>
) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const notified = JSON.parse(sessionStorage.getItem(NOTIFIED_KEY) || '[]');
  let updatedNotified = [...notified];
  let hasNewNotification = false;

  const today = new Date();
  today.setHours(0,0,0,0);

  patterns.forEach(p => {
    if (!p.nextDueDate) return;
    
    // --- DETERMINE TRIGGERS ---
    let triggers: NotificationTrigger[] = [];
    if (p.notificationTriggers && p.notificationTriggers.length > 0) {
      triggers = p.notificationTriggers;
    } else {
      // Default behavior if no specific triggers configured
      triggers = [
         { id: 'def1', days: 1, direction: 'before', target: 'due_date' },
         { id: 'def0', days: 0, direction: 'on_day', target: 'due_date' }
      ];
    }

    // --- PROCESS EACH TRIGGER ---
    triggers.forEach((trigger, idx) => {
       // Create unique key for this specific trigger instance today
       // Key format: patternId_triggerId_todayDate
       const triggerKey = `${p.id}_${trigger.id || idx}_${today.toDateString()}`;
       if (updatedNotified.includes(triggerKey)) return;

       // 1. Calculate Target Date
       let targetDate: Date | null = null;
       const linkedConfig = p.subCategory ? cardConfigs[p.subCategory] : null;

       if (trigger.target === 'due_date') {
          targetDate = new Date(p.nextDueDate);
       } else if (trigger.target === 'closing_date') {
          if (linkedConfig) {
             // We need to infer the closing date that corresponds to the current nextDueDate (payment).
             // Standard: DueDate = ClosingDate + Gap. So Closing ~ DueDate - Gap.
             const approxClosing = new Date(p.nextDueDate);
             approxClosing.setDate(approxClosing.getDate() - linkedConfig.paymentDueGap);
             // Get exact business day adjusted closing date
             const { closingDate } = calculateCardDates(linkedConfig, approxClosing);
             targetDate = closingDate;
          }
       }

       if (!targetDate) return; // Skip if target date can't be resolved (e.g. closing date selected but no card config)

       targetDate.setHours(0,0,0,0);

       // 2. Calculate Trigger Date based on Offset
       const triggerDate = new Date(targetDate);
       if (trigger.direction === 'before') {
          triggerDate.setDate(triggerDate.getDate() - trigger.days);
       } else if (trigger.direction === 'after') {
          triggerDate.setDate(triggerDate.getDate() + trigger.days);
       }
       // 'on_day' implies offset 0, which is already set

       // 3. Check if Today is the Trigger Date
       if (today.getTime() === triggerDate.getTime()) {
          const user = users.find(u => u.id === p.userId);
          const displayTitle = p.title || p.description;
          const currency = p.currency || 'USD'; 
          const symbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$'; 
          
          let title = `Reminder: ${displayTitle}`;
          let body = "";

          // Context aware messaging
          if (trigger.target === 'closing_date') {
             if (trigger.direction === 'after') {
                title = `Cierre Reciente: ${displayTitle}`;
                body = trigger.days === 1 ? `Tu tarjeta cerró ayer.` : `Tu tarjeta cerró hace ${trigger.days} días.`;
                
                // --- GENERATE SUMMARY ---
                if (linkedConfig) {
                   // Calculate cycle dates again to sum up total
                   const { closingDate: exactClosing } = calculateCardDates(linkedConfig, targetDate); // targetDate is closing date
                   
                   // Find start of cycle (roughly 1 month prior)
                   const prevMonthRef = new Date(exactClosing);
                   prevMonthRef.setDate(prevMonthRef.getDate() - 15);
                   prevMonthRef.setMonth(prevMonthRef.getMonth() - 1);
                   const { closingDate: prevClosing } = calculateCardDates(linkedConfig, prevMonthRef);
                   
                   const currentCycleStart = new Date(prevClosing);
                   currentCycleStart.setDate(currentCycleStart.getDate() + 1);
                   currentCycleStart.setHours(0,0,0,0);

                   const totalSpent = history
                     .filter(tx => 
                       tx.type === 'expense' &&
                       tx.paymentSubMethod === linkedConfig.subCategory &&
                       new Date(tx.createdDate) >= currentCycleStart &&
                       new Date(tx.createdDate) <= exactClosing
                     )
                     .reduce((sum, tx) => sum + tx.amount, 0);
                     
                   body += ` Total del ciclo: ${symbol}${totalSpent.toFixed(2)}`;
                }
             } else {
                title = `Cierre Próximo: ${displayTitle}`;
                body = `Tu tarjeta cierra en ${trigger.days} días.`;
             }
          } else {
             // Due Date
             if (trigger.direction === 'on_day') {
                title = `Vencimiento Hoy: ${displayTitle}`;
                body = `Hoy es la fecha límite de pago. Monto estimado: ${symbol}${p.amount}`;
             } else if (trigger.direction === 'before') {
                title = `Vencimiento Próximo: ${displayTitle}`;
                body = `Vence en ${trigger.days} días. Evita intereses pagando a tiempo.`;
             } else {
                title = `Vencimiento Pasado: ${displayTitle}`;
                body = `Tu vencimiento fue hace ${trigger.days} días.`;
             }
          }

          body += ` Asignado a: ${user?.name || 'Shared'}`;

          sendSystemNotification(title, body);
          
          updatedNotified.push(triggerKey);
          hasNewNotification = true;
       }
    });
  });

  if (hasNewNotification) {
    sessionStorage.setItem(NOTIFIED_KEY, JSON.stringify(updatedNotified));
  }
};
