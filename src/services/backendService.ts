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

  public async authFetch(url: string, options: RequestInit = {}) {
    const token = this.getToken();
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const res = await fetch(url, { ...options, headers });
    
    if (res.status === 401) {
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
      await this.authFetch(`/api/users/${uid}/notifications`);
    } catch (e) {}
  }

  async getChatHistory() {
    try {
      const res = await this.authFetch('/api/messages/history');
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
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
      const res = await this.authFetch('/api/game-state');
      const state = await res.json();
      return state || { budget: 5000000, taxRate: 0.20, trustRating: 60 };
    } catch (e) { return { budget: 5000000, taxRate: 0.20, trustRating: 60 }; }
  }

  onGlobalStateUpdate(callback: (state: any) => void) {
    const update = async () => {
      try {
        const state = await this.getGlobalState();
        callback(state);
      } catch (e) {}
    };
    if (this.globalInterval) clearInterval(this.globalInterval);
    this.globalInterval = setInterval(update, 3000);
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
      if (updates.taxRate !== undefined) {
         return this.setTaxRate(updates.taxRate);
      }
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

  // --- Rada & Economy ---
  async proposeBill(title: string, description: string, type: string) {
    try {
      const res = await this.authFetch('/api/rada/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, type })
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async setTaxRate(rate: number) {
    try {
      const res = await this.authFetch('/api/rada/tax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rate })
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async manageProposal(proposalId: string, action: 'approve' | 'reject') {
    try {
      const res = await this.authFetch('/api/rada/manage-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId, action })
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async applyVeto(_adminId: any, proposalId: string) {
    try {
      const res = await this.authFetch(`/api/rada/proposals/${proposalId}/veto`, { method: 'POST' });
      return await res.json();
    } catch (e: any) { return { success: false, error: e.message }; }
  }

  async addressThePeople(_adminId: any, message: string) {
    try {
      const res = await this.authFetch('/api/rada/address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      return await res.json();
    } catch (e: any) { return { success: false, error: e.message }; }
  }

  async businessRaid(_adminId?: any) {
    try {
      const res = await this.authFetch('/api/rada/raid', { method: 'POST' });
      return await res.json();
    } catch (e: any) { return { success: false, error: e.message }; }
  }

  async fundSphere(_adminId: any, sphereId: string, amount: number) {
    try {
      const res = await this.authFetch('/api/rada/fund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sphereId, amount })
      });
      return await res.json();
    } catch (e: any) { return { success: false, error: e.message }; }
  }

  async toggleMaidan(uid?: any) {
    try {
      const res = await this.authFetch('/api/rada/maidan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid })
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async sendNotification(uid: string, notification: { title: string, message: string, type: string }) {
    try {
      const res = await this.authFetch(`/api/users/${uid}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notification)
      });
      return await res.json();
    } catch (e) { return { success: false }; }
  }

  async adminUpdateUser(targetUid: string, updates: any, _adminName?: string) {
    try {
      const res = await this.authFetch(`/api/admin/users/${targetUid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      return await res.json();
    } catch (e: any) { return { success: false, error: e.message }; }
  }

  async adminMuteUser(targetUid: string, durationMinutes: number, reason: string, _adminName?: string) {
    try {
      const res = await this.authFetch(`/api/admin/users/${targetUid}/mute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationMinutes, reason })
      });
      return await res.json();
    } catch (e: any) { return { success: false, error: e.message }; }
  }

  async adminFreezeUser(targetUid: string, durationDays: number, reason: string, _adminName?: string) {
    try {
      const res = await this.authFetch(`/api/admin/users/${targetUid}/freeze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, durationDays })
      });
      return await res.json();
    } catch (e: any) { return { success: false, error: e.message }; }
  }

  async adminUnfreezeUser(targetUid: string, _adminName?: string) {
    try {
      const res = await this.authFetch(`/api/admin/users/${targetUid}/unfreeze`, { method: 'POST' });
      return await res.json();
    } catch (e: any) { return { success: false, error: e.message }; }
  }

  async adminDeleteUser(targetUid: string) {
    try {
      const res = await this.authFetch(`/api/admin/users/${targetUid}`, { method: 'DELETE' });
      return await res.json();
    } catch (e: any) { return { success: false, error: e.message }; }
  }

  async getProfileByEmail(email: string) {
    try {
      const res = await this.authFetch(`/api/users/by-email?email=${encodeURIComponent(email)}`);
      return res.ok ? await res.json() : null;
    } catch (e) { return null; }
  }

  async getAllPlayersForFraction() {
    try {
      const res = await this.authFetch('/api/players/all');
      return await res.json();
    } catch (e: any) { return []; }
  }

  async fireEmployee(adminId: string, targetId: string, reason: string) {
    try {
      const res = await this.authFetch('/api/rada/fire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUid: targetId, reason })
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async confiscateBusiness(adminId: string, targetUid: string, businessId: string, reason: string) {
    try {
      const res = await this.authFetch('/api/rada/confiscate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUid, businessId, reason })
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async shadowAudit(adminId: string, targetId: string) {
    try {
      const res = await this.authFetch('/api/rada/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUid: targetId })
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async toggleBusinessBlock(adminId: string, targetUid: string, businessId: string, block: boolean) {
    try {
      const res = await this.authFetch('/api/rada/block-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUid, businessId, block })
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async applyBonusOrPenalty(adminId: string, targetId: string, amount: number, reason: string) {
    try {
      const res = await this.authFetch('/api/rada/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          actionType: amount >= 0 ? 'bonus' : 'fine', 
          targetId, 
          amount: Math.abs(amount), 
          reason 
        })
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async issueFine(adminId: string, targetId: string, amount: number, reason: string, deadlineHours: number) {
    try {
      const res = await this.authFetch('/api/rada/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          actionType: 'fine', 
          targetId, 
          amount, 
          reason 
        })
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  // --- Bank Commands ---
  async performBankAction(adminId: string, actionType: string, targetId?: string, amount?: number, data?: any) {
    try {
      const res = await this.authFetch('/api/bank/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionType, targetId, amount, reason: data?.reason })
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async getFines(userId: string) {
    try {
      const res = await this.authFetch(`/api/users/${userId}/fines`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
  }

  async payFine(userId: string, fineId: string, amount: number, cardId: string) {
    try {
      const res = await this.authFetch(`/api/fines/${fineId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amount, cardId })
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  // --- Mafia Commands ---
  async fireMafiaMember(bossId: string, targetId: string, reason: string) {
    try {
      const res = await this.authFetch('/api/mafia/fire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUid: targetId, reason })
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async getMafiaTargets() {
    try {
      const res = await this.authFetch('/api/mafia/targets');
      return res.ok ? await res.json() : [];
    } catch (e: any) { return []; }
  }

  async performMafiaAction(adminId: string, actionType: string, targetId?: string, amount?: number, data?: any) {
    try {
      const res = await this.authFetch('/api/mafia/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionType, targetId, amount, data })
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async transferMoney(fromId: string, toId: string, amount: number) {
    try {
      const res = await fetch('/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromId, toId, amount })
      });
      return await res.json();
    } catch (e: any) { return { success: false, error: e.message }; }
  }

  async triggerPayDay(userId: string) {
    try {
      const res = await this.authFetch(`/api/players/${userId}/payday`, { method: 'POST' });
      return await res.json();
    } catch (e: any) { return { success: false, error: e.message }; }
  }

  async searchUsers(queryStr: string) {
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(queryStr)}`);
      return res.ok ? await res.json() : [];
    } catch (e: any) { return []; }
  }

  async auditUser(adminId: string, targetId: string) {
    try {
      const res = await this.authFetch(`/api/rada/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUid: targetId })
      });
      return await res.json();
    } catch (e: any) { return { success: false, error: e.message }; }
  }

  async distributeSocialSupport(amount: number, type: 'support' | 'pension') {
    try {
      const res = await fetch('/api/system/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, type })
      });
      return await res.json();
    } catch (e: any) { return { success: false, error: e.message }; }
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

  disconnect() {
    this.stopSession();
    if (this.eventsInterval) clearTimeout(this.eventsInterval);
    if (this.globalInterval) clearInterval(this.globalInterval);
    this.eventsInterval = null;
    this.globalInterval = null;
  }

  async collectBusinessProfit(businessId: string, amount: number, payTax: boolean) {
    try {
      const res = await this.authFetch('/api/business/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, amount, payTax })
      });
      return await res.json();
    } catch (e: any) { return { success: false, error: e.message }; }
  }
  
  async buyProtection(businessId: string) {
    try {
      const res = await this.authFetch('/api/business/protect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId })
      });
      return await res.json();
    } catch (e: any) { return { success: false, error: e.message }; }
  }
}

export const backend = new BackendService();
