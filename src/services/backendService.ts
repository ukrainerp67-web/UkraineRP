import { auth } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged
} from 'firebase/auth';

class BackendService {
  private playersUpdateCallback: ((players: any[]) => void) | null = null;
  private messageCallback: ((msg: any) => void) | null = null;
  private presenceInterval: any = null;
  private eventsInterval: any = null;
  private globalInterval: any = null;
  private notificationsInterval: any = null;
  private messagesInterval: any = null;
  private lastProcessedMessageId: number = 0;

  constructor() {
    this.setupPresence();
    this.setupPolling();
  }

  private setupPresence() {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        if (!this.presenceInterval) {
          this.presenceInterval = setInterval(() => {
            fetch(`/api/presence/${user.uid}`, { method: 'POST' });
            this.syncOnlinePlayers();
          }, 3000);
          this.syncOnlinePlayers();
        }
      } else {
        if (this.presenceInterval) {
          clearInterval(this.presenceInterval);
          this.presenceInterval = null;
        }
      }
    });
  }

  private setupPolling() {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        // Notifications Polling
        if (!this.notificationsInterval) {
          this.notificationsInterval = setInterval(() => this.syncNotifications(user.uid), 10000);
        }
        // Messages Polling
        if (!this.messagesInterval) {
          this.messagesInterval = setInterval(() => this.syncMessages(), 4000);
        }
      } else {
        clearInterval(this.notificationsInterval);
        clearInterval(this.messagesInterval);
        this.notificationsInterval = null;
        this.messagesInterval = null;
      }
    });
  }

  private async syncOnlinePlayers() {
     try {
       const res = await fetch('/api/online');
       const players = await res.json();
       if (this.playersUpdateCallback) this.playersUpdateCallback(players);
     } catch (e) { /* ignore silent failure */ }
  }

  private async syncNotifications(uid: string) {
    try {
      const res = await fetch(`/api/users/${uid}/notifications`);
      const notifications = await res.json();
      // Internal event for UI if needed, for simplicity we rely on manual fetch in Notifications component
    } catch (e) {}
  }

  private async syncMessages() {
    try {
      const res = await fetch('/api/messages');
      const messages = await res.json();
      if (this.messageCallback) {
        messages.forEach((msg: any) => {
          if (msg.id > this.lastProcessedMessageId) {
            this.messageCallback!(msg);
            this.lastProcessedMessageId = msg.id;
          }
        });
      }
    } catch (e) {}
  }

  // Auth
  getToken() { return localStorage.getItem("token"); }

  async logout() {
    try {
      await signOut(auth);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      return { success: true };
    } catch (error: any) { return { error: error.message }; }
  }

  async login(credentials: any) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
      const token = await userCredential.user.getIdToken();
      localStorage.setItem("token", token);
      const profile = await this.getProfile(userCredential.user.uid);
      return { user: userCredential.user, profile };
    } catch (error: any) { return { error: error.message }; }
  }

  async register(credentials: any) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, credentials.email, credentials.password);
      const token = await userCredential.user.getIdToken();
      localStorage.setItem("token", token);
      return { user: userCredential.user };
    } catch (error: any) { return { error: error.message }; }
  }

  // Profile
  async getProfile(uid: string, email?: string) {
    if (!uid) return null;
    try {
      const url = email ? `/api/profile/${uid}?email=${encodeURIComponent(email)}` : `/api/profile/${uid}`;
      const res = await fetch(url);
      return res.ok ? await res.json() : null;
    } catch (e) { return null; }
  }

  async getProfileByEmail(email: string) {
    if (!email) return null;
    try {
      const res = await fetch(`/api/profile/email/${encodeURIComponent(email)}`);
      return res.ok ? await res.json() : null;
    } catch (e) { return null; }
  }

  async deleteProfile(uid: string) {
    try {
      const res = await fetch(`/api/profile/${uid}`, { method: 'DELETE' });
      return await res.json();
    } catch (e) { return { success: false, error: e }; }
  }

  async saveProfile(profile: any) {
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      return await res.json();
    } catch (e) { return { success: false, error: e }; }
  }

  async patchProfile(uid: string, updates: any) {
    try {
      const res = await fetch(`/api/profile/${uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      return await res.json();
    } catch (e) { return { success: false, error: e }; }
  }

  // Global State
  async getGlobalState() {
    try {
      const res = await fetch('/api/system/global');
      const state = await res.json();
      return state || { budget: 1000000, taxRate: 0.20, trustRating: 60 };
    } catch (e) { return { budget: 1000000, taxRate: 0.20, trustRating: 60 }; }
  }

  onGlobalStateUpdate(callback: (state: any) => void) {
    if (this.globalInterval) clearInterval(this.globalInterval);
    this.globalInterval = setInterval(async () => {
      const state = await this.getGlobalState();
      callback(state);
    }, 10000);
    this.getGlobalState().then(callback);
    return () => clearInterval(this.globalInterval);
  }

  onProfileUpdate(uid: string, email: string | null, callback: (profile: any) => void) {
    const update = async () => {
      const profile = await this.getProfile(uid, email || undefined);
      callback(profile); // Call even if null so subscriber knows fetch finished
    };
    const interval = setInterval(update, 2000); // Faster polling for better UX
    update();
    return () => clearInterval(interval);
  }

  async updateGlobalState(updates: any) {
    try {
      const res = await fetch('/api/system/global', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      return await res.json();
    } catch (e) { return { success: false, error: e }; }
  }

  async addToBudget(amount: number) { return this.updateGlobalState({ budget: amount }); }
  async removeFromBudget(amount: number) { return this.updateGlobalState({ budget: -amount }); }

  // Events & Logging
  async logEvent(event: { type: string; message: string; player: string }) {
    try {
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      });
    } catch (e) {}
  }

  onEventsUpdate(callback: (events: any[]) => void) {
    if (this.eventsInterval) clearInterval(this.eventsInterval);
    this.eventsInterval = setInterval(async () => {
      const res = await fetch('/api/events');
      callback(await res.json());
    }, 15000);
    fetch('/api/events').then(res => res.json()).then(callback);
    return () => clearInterval(this.eventsInterval);
  }

  // Game Actions
  async applyVeto(adminId: string, action: string) {
    await this.logEvent({ type: 'veto', message: `Президент застосував ВЕТО до дії: "${action}"`, player: adminId });
    return { success: true };
  }

  async setTaxRate(adminId: string, newRate: number) {
    if (newRate < 0 || newRate > 0.5) return { success: false, message: 'Податок має бути від 0% до 50%' };
    await this.updateGlobalState({ taxRate: newRate });
    await this.logEvent({ type: 'tax_change', message: `Міністр фінансів встановив новий податок: ${(newRate * 100).toFixed(0)}%`, player: adminId });
    return { success: true };
  }

  async businessRaid(adminId: string) {
    const amount = Math.floor(Math.random() * 40000) + 10000;
    await this.updateGlobalState({ budget: amount, trustRating: -10 });
    await this.logEvent({ type: 'raid', message: `Податкова провела рейд на бізнес! До бюджету зараховано ₴${amount.toLocaleString()}.`, player: adminId });
    return { success: true, amount };
  }

  async addressThePeople(adminId: string, speech: string) {
    const trustChange = Math.floor(Math.random() * 15) + 5;
    await this.updateGlobalState({ trustRating: trustChange });
    await this.logEvent({ type: 'president_speech', message: `Президент звернувся до народу. Рейтинг довіри зріс на ${trustChange}%!`, player: adminId });
    return { success: true, trustChange };
  }

  async fundSphere(adminId: string, sphere: string, amount: number) {
    const result = await this.removeFromBudget(amount);
    if (!result.success) return result;
    const trustChange = Math.floor(amount / 50000);
    await this.updateGlobalState({ trustRating: trustChange });
    await this.logEvent({ type: 'funding', message: `Виділено ₴${amount.toLocaleString()} на сферу: ${sphere}.`, player: adminId });
    return { success: true };
  }

  async sendNotification(uid: string, notification: { title: string, message: string, type: string }) {
    try {
      await fetch(`/api/users/${uid}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notification)
      });
    } catch (e) {}
  }

  async applyBonusOrPenalty(adminId: string, targetId: string, amount: number, reason: string) {
    try {
      const target = await this.getProfile(targetId);
      if (!target) return { success: false, message: 'Ціль не знайдена' };

      if (amount > 0) {
        const budgetResult = await this.removeFromBudget(amount);
        if (!budgetResult.success) return budgetResult;
      }

      const bankCards = [...(target.bankCards || [])];
      let cardIdx = bankCards.findIndex((c: any) => c.type === 'standard' || c.type === 'universal');
      if (cardIdx === -1) {
        await this.patchProfile(targetId, { balance: (target.balance || 0) + amount });
      } else {
        bankCards[cardIdx].balance += amount;
        await this.patchProfile(targetId, { bankCards });
      }

      await this.sendNotification(targetId, {
        title: amount >= 0 ? '💰 Премія' : '💳 Фінансова санкція',
        message: `Вам призначено суму ₴${Math.abs(amount).toLocaleString()}. Причина: ${reason}`,
        type: amount >= 0 ? 'success' : 'error'
      });
      return { success: true };
    } catch (e) { return { success: false, error: e }; }
  }

  async issueFine(adminId: string, targetId: string, amount: number, reason: string, deadlineHours: number) {
    const deadline = new Date(Date.now() + deadlineHours * 3600000);
    await fetch(`/api/users/${targetId}/fines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, reason, deadline: deadline.toISOString() })
    });
    await this.sendNotification(targetId, { title: '⚖️ Новий Штраф', message: `До оплати: ₴${amount.toLocaleString()}. Причина: ${reason}. Термін: ${deadlineHours} год.`, type: 'error' });
    return { success: true };
  }

  async getFines(userId: string) {
    try {
      const res = await fetch(`/api/users/${userId}/fines`);
      return await res.json();
    } catch (e) { return []; }
  }

  async payFine(userId: string, fineId: string, amount: number, cardId: string) {
    const profile = await this.getProfile(userId);
    if (!profile) return { success: false };
    
    const bankCards = [...(profile.bankCards || [])];
    const cardIdx = bankCards.findIndex((c: any) => c.number === cardId);
    if (cardIdx === -1 || bankCards[cardIdx].balance < amount) {
      return { success: false, message: 'Недостатньо коштів на картці' };
    }

    bankCards[cardIdx].balance -= amount;
    await this.patchProfile(userId, { bankCards });
    await fetch(`/api/fines/${fineId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'paid' }) });
    await this.addToBudget(amount);
    return { success: true };
  }

  async transferMoney(fromId: string, toId: string, amount: number) {
    try {
      const res = await fetch('/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromId, toId, amount })
      });
      return await res.json();
    } catch (e) { return { success: false, error: e }; }
  }

  async triggerPayDay(userId: string) {
    try {
      const profile = await this.getProfile(userId);
      if (!profile) return { success: false };
      
      const salaryRates: Record<string, number> = { 'Президент': 10000, "Міністр": 7000, 'Громадянин': 2000 };
      const gross = salaryRates[profile.role] || 2000;
      const global = await this.getGlobalState();
      const taxAmount = Math.floor(gross * global.taxRate);
      const net = gross - taxAmount;

      const bankCards = [...(profile.bankCards || [])];
      if (bankCards.length > 0) {
        bankCards[0].balance += net;
        await this.patchProfile(userId, { bankCards, lastPayDay: new Date().toISOString() });
        await this.addToBudget(taxAmount);
        await this.sendNotification(userId, { title: '💰 PayDay', message: `Зарплата: ₴${net}. Податок: ₴${taxAmount}`, type: 'success' });
        return { success: true };
      }
      return { success: false, message: 'Немає карти' };
    } catch (e) { return { success: false }; }
  }

  async searchUsers(queryStr: string) {
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(queryStr)}`);
      return res.ok ? await res.json() : [];
    } catch (e) {
      console.error('searchUsers error:', e);
      return [];
    }
  }

  async auditUser(adminId: string, targetId: string) {
    const target = await this.getProfile(targetId);
    if (!target) return { success: false };
    const totalAssets = (target.balance || 0) + (target.bankCards || []).reduce((acc: number, c: any) => acc + (c.balance || 0), 0);
    await this.logEvent({ type: 'audit', message: `Проведено аудит гравця ${target.firstName} ${target.lastName}. Виявлено капітал: ₴${totalAssets.toLocaleString()}`, player: adminId });
    return { success: true, totalAssets };
  }

  async distributeSocialSupport(amount: number, type: 'support' | 'pension') {
    try {
      const res = await fetch('/api/system/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, type })
      });
      return await res.json();
    } catch (e) { return { success: false, error: e }; }
  }

  onFinesUpdate(userId: string, callback: (fines: any[]) => void) {
    const update = async () => {
      const fines = await this.getFines(userId);
      callback(fines);
    };
    const interval = setInterval(update, 10000);
    update();
    return () => clearInterval(interval);
  }

  async joinGame(data: { uid: string; name: string; status: string }) {
    try {
      await fetch(`/api/presence/${data.uid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch (e) {}
  }

  disconnect() {
    if (this.presenceInterval) clearInterval(this.presenceInterval);
    if (this.eventsInterval) clearInterval(this.eventsInterval);
    if (this.globalInterval) clearInterval(this.globalInterval);
    if (this.notificationsInterval) clearInterval(this.notificationsInterval);
    if (this.messagesInterval) clearInterval(this.messagesInterval);
    this.presenceInterval = null;
    this.eventsInterval = null;
    this.globalInterval = null;
    this.notificationsInterval = null;
    this.messagesInterval = null;
  }

  async getChatHistory() {
    const res = await fetch('/api/messages');
    return await res.json();
  }

  async adminUpdateUser(targetId: string, updates: any, adminName?: string) {
    if (adminName) {
      await this.logEvent({ type: 'admin_edit', message: `Адміністратор ${adminName} оновив дані користувачаID: ${targetId}`, player: adminName });
    }
    return this.patchProfile(targetId, updates);
  }

  async adminMuteUser(targetId: string, durationMinutes: number, reason: string, adminName: string) {
    const muteUntil = new Date(Date.now() + durationMinutes * 60000).toISOString();
    await this.logEvent({ type: 'mute', message: `Адміністратор ${adminName} видав мут гравцеві ID: ${targetId} на ${durationMinutes}хв. Причина: ${reason}`, player: adminName });
    return this.patchProfile(targetId, { muteUntil });
  }

  async adminFreezeUser(targetId: string, durationMinutes: number, reason: string, adminName: string) {
    const freezeUntil = durationMinutes === -1 ? '9999-12-31T23:59:59.999Z' : new Date(Date.now() + durationMinutes * 60000).toISOString();
    await this.logEvent({ type: 'freeze', message: `Адміністратор ${adminName} заморозив гравця ID: ${targetId}. Причина: ${reason}`, player: adminName });
    return this.patchProfile(targetId, { isFrozen: true, freezeReason: reason, freezeUntil });
  }

  async adminUnfreezeUser(targetId: string, adminName: string) {
    await this.logEvent({ type: 'unfreeze', message: `Адміністратор ${adminName} розморозив гравця ID: ${targetId}`, player: adminName });
    return this.patchProfile(targetId, { isFrozen: false, freezeReason: null, freezeUntil: null });
  }

  async adminDeleteUser(targetId: string) {
    return this.deleteProfile(targetId);
  }

  onAdminUsersUpdate(callback: (users: any[]) => void) {
    const update = async () => {
      try {
        const res = await fetch('/api/admin/users');
        if (res.ok) {
          const users = await res.json();
          callback(users);
        }
      } catch (e) {
        console.error('onAdminUsersUpdate error:', e);
      }
    };
    const interval = setInterval(update, 10000);
    update();
    return () => clearInterval(interval);
  }

  onPlayersUpdate(callback: (players: any[]) => void) {
    this.playersUpdateCallback = callback;
    return () => this.playersUpdateCallback = null;
  }

  onNewMessage(callback: (msg: any) => void) {
    this.messageCallback = callback;
    return () => this.messageCallback = null;
  }

  sendMessage(msg: any) {
    fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(msg) });
  }

  async toggleBusinessBlock(adminId: string, targetId: string, businessId: string, shouldBlock: boolean) {
    const target = await this.getProfile(targetId);
    if (!target) return { success: false };
    const businesses = (target.businesses || []).map((b: any) => b.businessId === businessId ? { ...b, isBlocked: shouldBlock } : b);
    await this.patchProfile(targetId, { businesses });
    return { success: true };
  }
}

export const backend = new BackendService();
