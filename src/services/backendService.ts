class BackendService {
  private playersUpdateCallback: ((players: any[]) => void) | null = null;
  private messageCallback: ((msg: any) => void) | null = null;
  private presenceInterval: any = null;
  private eventsInterval: any = null;
  private globalInterval: any = null;
  private notificationsInterval: any = null;
  private messagesInterval: any = null;
  private lastProcessedMessageId: number = 0;
  private currentUserUid: string | null = null;

  constructor() {
    const saved = localStorage.getItem("user");
    if (saved) {
      try {
        const u = JSON.parse(saved);
        this.startSession(u.uid);
      } catch (e) {}
    }
    this.setupPolling();
  }

  private startSession(uid: string) {
    this.currentUserUid = uid;
    
    const pollPresence = async () => {
      if (this.currentUserUid !== uid) return;
      try {
        await this.authFetch(`/api/presence/${uid}`, { method: 'POST' });
        await this.syncOnlinePlayers();
      } catch (e) {}
      this.presenceInterval = setTimeout(pollPresence, 3000);
    };

    const pollNotifications = async () => {
      if (this.currentUserUid !== uid) return;
      try {
        await this.syncNotifications(uid);
      } catch (e) {}
      this.notificationsInterval = setTimeout(pollNotifications, 5000);
    };

    const pollMessages = async () => {
      if (this.currentUserUid !== uid) return;
      try {
        await this.syncMessages();
      } catch (e) {}
      this.messagesInterval = setTimeout(pollMessages, 2000);
    };

    if (this.presenceInterval) clearTimeout(this.presenceInterval);
    if (this.notificationsInterval) clearTimeout(this.notificationsInterval);
    if (this.messagesInterval) clearTimeout(this.messagesInterval);

    pollPresence();
    pollNotifications();
    pollMessages();
  }

  private stopSession() {
    this.currentUserUid = null;
    if (this.presenceInterval) clearTimeout(this.presenceInterval);
    if (this.notificationsInterval) clearTimeout(this.notificationsInterval);
    if (this.messagesInterval) clearTimeout(this.messagesInterval);
    this.presenceInterval = null;
    this.notificationsInterval = null;
    this.messagesInterval = null;
  }

  private setupPolling() {
      const pollEvents = async () => {
        try {
          await this.syncEvents();
        } catch (e) {}
        this.eventsInterval = setTimeout(pollEvents, 30000);
      };
      
      if (!this.eventsInterval) {
        pollEvents();
      }
  }

  private async syncEvents() {
    // This will be called by components if they subscribe
  }

  private async authFetch(url: string, options: RequestInit = {}) {
    const token = this.getToken();
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const res = await fetch(url, { ...options, headers });
    
    if (res.status === 401) {
      // Avoid redirect if we are already on registration or if the token is already gone
      const token = this.getToken();
      if (token && window.location.pathname !== '/' && !window.location.pathname.includes('register')) {
        console.warn('Auth token invalid or expired. Logging out.');
        this.logout();
        window.location.href = '/';
      }
    }
    
    return res;
  }

  private async syncOnlinePlayers() {
     try {
       const res = await this.authFetch('/api/online');
       const data = await res.json();
       const players = Array.isArray(data) ? data : [];
       if (this.playersUpdateCallback) this.playersUpdateCallback(players);
     } catch (e) { /* ignore silent failure */ }
  }

  async getNotifications(uid: string) {
    try {
      const res = await this.authFetch(`/api/users/${uid}/notifications`);
      return res.ok ? await res.json() : [];
    } catch (e) { return []; }
  }

  private async syncNotifications(uid: string) {
    try {
      const res = await this.authFetch(`/api/users/${uid}/notifications`);
      const notifications = await res.json();
      // Internal event for UI if needed, for simplicity we rely on manual fetch in Notifications component
    } catch (e) {}
  }

  private async syncMessages() {
    try {
      const res = await this.authFetch('/api/messages');
      const data = await res.json();
      const messages = Array.isArray(data) ? data : [];
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

  logout() {
    this.stopSession();
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    return { success: true };
  }

  async login(credentials: any) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: credentials.email, password: credentials.password })
      });
      const data = await res.json();
      if (data.success) {
        this.startSession(data.user.uid);
      }
      return data;
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async register(credentials: any) {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      const data = await res.json();
      if (data.success) {
        this.startSession(data.user.uid);
      }
      return data;
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  // Profile
  async getProfile(uid: string, email?: string) {
    if (!uid) return null;
    try {
      const url = email ? `/api/profile/${uid}?email=${encodeURIComponent(email)}` : `/api/profile/${uid}`;
      const res = await this.authFetch(url);
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
      const res = await this.authFetch(`/api/profile/${uid}`, { method: 'DELETE' });
      return await res.json();
    } catch (e) { return { success: false, error: e }; }
  }

  async saveProfile(profile: any) {
    try {
      const res = await this.authFetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      return await res.json();
    } catch (e) { return { success: false, error: e }; }
  }

  async patchProfile(uid: string, updates: any) {
    try {
      const res = await this.authFetch(`/api/profile/${uid}`, {
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
    const update = async () => {
      try {
        const state = await this.getGlobalState();
        callback(state);
      } catch (e) {}
    };
    if (this.globalInterval) clearInterval(this.globalInterval);
    this.globalInterval = setInterval(update, 5000);
    update();
    return () => clearInterval(this.globalInterval);
  }

  onProfileUpdate(uid: string, email: string | null, callback: (profile: any) => void) {
    const update = async () => {
      try {
        const profile = await this.getProfile(uid, email || undefined);
        callback(profile);
      } catch (e) {}
    };
    const interval = setInterval(update, 2000);
    update();
    return () => clearInterval(interval);
  }

  async updateGlobalState(updates: any) {
    try {
      const res = await this.authFetch('/api/system/global', {
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
      const data = await res.json();
      callback(Array.isArray(data) ? data : []);
    }, 15000);
    fetch('/api/events').then(res => res.json()).then(data => callback(Array.isArray(data) ? data : []));
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
      const data = await res.json();
      return Array.isArray(data) ? data : [];
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
    const interval = setInterval(update, 3000);
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
    try {
      const res = await fetch('/api/messages');
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
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
        const res = await this.authFetch('/api/admin/users');
        if (res.ok) {
          const data = await res.json();
          callback(Array.isArray(data) ? data : []);
        } else {
          callback([]);
        }
      } catch (e) {
        console.error('onAdminUsersUpdate error:', e);
        callback([]);
      }
    };
    const interval = setInterval(update, 4000);
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
