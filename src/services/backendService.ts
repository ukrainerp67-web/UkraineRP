import { 
  auth, 
  db, 
  handleFirestoreError, 
  OperationType 
} from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  query, 
  where,
  onSnapshot,
  serverTimestamp,
  runTransaction,
  addDoc,
  deleteDoc,
  orderBy,
  limit
} from 'firebase/firestore';

class BackendService {
  private playersUpdateCallback: ((players: any[]) => void) | null = null;
  private messageCallback: ((msg: any) => void) | null = null;

  private presenceUnsubscribe: (() => void) | null = null;
  private messagesUnsubscribe: (() => void) | null = null;

  constructor() {
    // We are now using Firebase for all real-time features
  }

  private setupPresence() {
    if (this.presenceUnsubscribe) return;

    onAuthStateChanged(auth, (user) => {
      if (user) {
        const presenceRef = doc(db, 'presence', user.uid);
        setDoc(presenceRef, {
          uid: user.uid,
          lastActive: serverTimestamp(),
          status: 'online'
        }, { merge: true });

        // Listen for all players from users collection to recover "disappeared" data
        this.presenceUnsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
          const players = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          if (this.playersUpdateCallback) {
            this.playersUpdateCallback(players);
          }
        }, (error) => {
          console.warn("Presence snapshot error", error);
        });
      } else {
        if (this.presenceUnsubscribe) {
          this.presenceUnsubscribe();
          this.presenceUnsubscribe = null;
        }
      }
    });
  }

  getToken() {
    return localStorage.getItem("token");
  }

  async logout() {
    try {
      await signOut(auth);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      return { success: true };
    } catch (error: any) {
      return { error: error.message };
    }
  }

  async login(credentials: any) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
      const token = await userCredential.user.getIdToken();
      localStorage.setItem("token", token);
      
      const profile = await this.getProfile(userCredential.user.uid, userCredential.user);
      return { user: userCredential.user, profile };
    } catch (error: any) {
      return { error: error.message };
    }
  }

  async register(credentials: any) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, credentials.email, credentials.password);
      const token = await userCredential.user.getIdToken();
      localStorage.setItem("token", token);
      return { user: userCredential.user };
    } catch (error: any) {
      return { error: error.message };
    }
  }

  async getGlobalState() {
    try {
      const docRef = doc(db, 'system', 'global');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data();
      }
      // Initialize if not exists
      const initialState = {
        budget: 1000000,
        taxRate: 0.20,
        trustRating: 60,
        updatedAt: serverTimestamp()
      };
      await setDoc(docRef, initialState);
      return initialState;
    } catch (error) {
      console.error('Error getting global state:', error);
      return { budget: 1000000, taxRate: 0.20, trustRating: 60 };
    }
  }

  onGlobalStateUpdate(callback: (state: any) => void) {
    const docRef = doc(db, 'system', 'global');
    return onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        callback(doc.data());
      } else {
        // Fallback or trigger first get
        this.getGlobalState().then(callback);
      }
    }, (error) => {
      console.error("Global state snapshot error", error);
    });
  }

  async updateGlobalState(updates: any) {
    try {
      const docRef = doc(db, 'system', 'global');
      await setDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      }, { merge: true });
      return { success: true };
    } catch (error) {
      console.error('Error updating global state:', error);
      return { success: false, error };
    }
  }

  async addToBudget(amount: number) {
    try {
      const globalState = await this.getGlobalState();
      await this.updateGlobalState({ budget: (globalState.budget || 0) + amount });
      return { success: true };
    } catch (error) {
      console.error('Error adding to budget:', error);
      return { success: false, error };
    }
  }

  async removeFromBudget(amount: number) {
    try {
      const globalState = await this.getGlobalState();
      if ((globalState.budget || 0) < amount) throw new Error('Недостатньо коштів у бюджеті');
      await this.updateGlobalState({ budget: (globalState.budget || 0) - amount });
      return { success: true };
    } catch (error) {
      console.error('Error removing from budget:', error);
      return { success: false, error };
    }
  }

  async logEvent(event: { type: string; message: string; player: string }) {
    try {
      const eventsRef = collection(db, 'global_events');
      await addDoc(eventsRef, {
        ...event,
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.error("Error logging event", e);
    }
  }

  onEventsUpdate(callback: (events: any[]) => void) {
    const q = query(collection(db, 'global_events'), orderBy('timestamp', 'desc'), limit(10));
    return onSnapshot(q, (snapshot) => {
      const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(events);
    }, (error) => {
      console.error("Events snapshot error", error);
    });
  }

  async applyVeto(adminId: string, action: string) {
    try {
      const globalState = await this.getGlobalState();
      await this.logEvent({
        type: 'veto',
        message: `Президент застосував ВЕТО до дії: "${action}"`,
        player: adminId
      });
      // Logic for veto can be complex, for now we log it and maybe revert a budget change if possible
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  }

  async setTaxRate(adminId: string, newRate: number) {
    if (newRate < 0 || newRate > 0.5) return { success: false, message: 'Податок має бути від 0% до 50%' };
    try {
      await this.updateGlobalState({ taxRate: newRate });
      await this.logEvent({
        type: 'tax_change',
        message: `Міністр фінансів встановив новий податок: ${(newRate * 100).toFixed(0)}%`,
        player: adminId
      });
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  }

  async updateTrustRating(change: number) {
    try {
      const globalState = await this.getGlobalState();
      let newRating = (globalState.trustRating || 60) + change;
      newRating = Math.max(0, Math.min(100, newRating));
      await this.updateGlobalState({ trustRating: newRating });
      return { success: true, newRating };
    } catch (error) {
      return { success: false, error };
    }
  }

  async businessRaid(adminId: string) {
    try {
      const amount = Math.floor(Math.random() * 40000) + 10000;
      const globalState = await this.getGlobalState();
      await this.updateGlobalState({ 
        budget: (globalState.budget || 0) + amount,
        trustRating: (globalState.trustRating || 60) - 10
      });
      await this.logEvent({
        type: 'raid',
        message: `Податкова провела рейд на бізнес! До бюджету зараховано ₴${amount.toLocaleString()}. Рейтинг довіри впав.`,
        player: adminId
      });
      return { success: true, amount };
    } catch (error) {
      return { success: false, error };
    }
  }

  async addressThePeople(adminId: string, speech: string) {
    try {
      const trustChange = Math.floor(Math.random() * 15) + 5;
      await this.updateTrustRating(trustChange);
      await this.logEvent({
        type: 'president_speech',
        message: `Президент звернувся до народу: "${speech.substring(0, 100)}...". Рейтинг довіри зріс на ${trustChange}%!`,
        player: adminId
      });
      return { success: true, trustChange };
    } catch (error) {
      return { success: false, error };
    }
  }

  async fundSphere(adminId: string, sphere: string, amount: number) {
    try {
      const result = await this.removeFromBudget(amount);
      if (!result.success) return result;

      const trustChange = Math.floor(amount / 50000);
      await this.updateTrustRating(trustChange);
      await this.logEvent({
        type: 'funding',
        message: `Прем'єр-міністр виділив ₴${amount.toLocaleString()} на сферу: ${sphere}. Рейтинг довіри зріс на ${trustChange}%!`,
        player: adminId
      });
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  }

  async issueReprimand(adminId: string, targetId: string, reason: string) {
    try {
      const target = await this.getProfile(targetId);
      if (!target) return { success: false, message: 'Ціль не знайдена' };

      await this.sendNotification(targetId, {
        title: '⚠️ Офіційна Догана',
        message: `Президент виніс вам догану. Причина: ${reason}. Три догани — звільнення!`,
        type: 'error'
      });

      await this.logEvent({
        type: 'reprimand',
        message: `Президент виніс догану посадовцю ${target.firstName} ${target.lastName}. Причина: ${reason}`,
        player: adminId
      });
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  }

  async freezeAccount(adminId: string, targetId: string) {
    try {
      const target = await this.getProfile(targetId);
      if (!target) return { success: false, message: 'Ціль не знайдена' };

      // Simplified: we'll just log it and maybe add a field to user
      await updateDoc(doc(db, 'users', targetId), {
        accountFrozenUntil: serverTimestamp(), // Logic for check can be added to PayDay
        updatedAt: serverTimestamp()
      });

      await this.sendNotification(targetId, {
        title: '🚫 Рахунок заблоковано',
        message: 'ВФБ заблокував ваші особисті рахунки на 2 цикли PayDay!',
        type: 'error'
      });

      await this.logEvent({
        type: 'freeze',
        message: `ВФБ заблокував рахунок гравця ${target.firstName} ${target.lastName}`,
        player: adminId
      });
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  }

  async auditUser(adminId: string, targetId: string) {
    try {
      const target = await this.getProfile(targetId);
      if (!target) return { success: false, message: 'Ціль не знайдена' };
      
      const isCorrupt = Math.random() < 0.3;
      const report = isCorrupt 
        ? `ВФБ виявило незадекларовані доходи у розмірі ₴${(Math.floor(Math.random() * 50000) + 10000).toLocaleString()}!` 
        : 'Аудит не виявив порушень.';

      await this.logEvent({
        type: 'audit',
        message: `Аудит гравця ${target.firstName} ${target.lastName}: ${report}`,
        player: adminId
      });
      
      return { success: true, isCorrupt, report };
    } catch (error) {
      return { success: false, error };
    }
  }

  async applyBonusOrPenalty(adminId: string, targetId: string, amount: number, reason: string) {
    try {
      const target = await this.getProfile(targetId);
      if (!target) return { success: false, message: 'Ціль не знайдена' };

      const bankCards = [...(target.bankCards || [])];
      let cardIdx = bankCards.findIndex(c => c.type === 'standard');
      if (cardIdx === -1 && bankCards.length > 0) cardIdx = 0;

      if (cardIdx !== -1) {
        bankCards[cardIdx].balance = (Number(bankCards[cardIdx].balance) || 0) + amount;
        await updateDoc(doc(db, 'users', targetId), { 
          bankCards,
          updatedAt: serverTimestamp() 
        });
      } else {
        await updateDoc(doc(db, 'users', targetId), { 
          balance: (Number(target.balance) || 0) + amount,
          updatedAt: serverTimestamp()
        });
      }

      const typeStr = amount >= 0 ? 'ПРЕМІЮ' : 'ШТРАФ';
      await this.sendNotification(targetId, {
        title: `💰 ${typeStr}`,
        message: `Вам призначено ${typeStr.toLowerCase()} у розмірі ₴${Math.abs(amount).toLocaleString()}. Причина: ${reason}`,
        type: amount >= 0 ? 'success' : 'error'
      });

      await this.logEvent({
        type: 'financial_action',
        message: `${adminId} призначив ${typeStr.toLowerCase()} гравцю ${target.firstName} на суму ₴${Math.abs(amount).toLocaleString()}. Причина: ${reason}`,
        player: adminId
      });

      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  }

  async triggerPayDay(userId: string) {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return { success: false, message: 'Користувача не знайдено' };
      
      const data = userSnap.data();
      const role = data.role || 'Громадянин';
      
      // Salary configuration (PayDay)
      const salaryRates: Record<string, number> = {
        'Президент': 10000,
        "Прем'єр-міністр": 8500,
        "Прем'єр Міністр": 8500,
        "Прем'єр міністр": 8500,
        'Міністр фінансів': 7000,
        'Працівник ВФБ': 4000,
        'Депутат': 5000,
        'admin': 10000
      };

      const lastPayDay = data.lastPayDay ? (data.lastPayDay.toMillis ? data.lastPayDay.toMillis() : new Date(data.lastPayDay).getTime()) : 0;
      const nowTs = Date.now();
      const fifteenMins = 15 * 60 * 1000;

      // Allow bypass if specifically triggered by admin or for debug (optional)
      if (nowTs - lastPayDay < fifteenMins && !data.isSuperAdmin) {
        const remaining = Math.ceil((fifteenMins - (nowTs - lastPayDay)) / 1000 / 60);
        return { success: false, message: `Наступна зарплата доступна через ${remaining} хв.` };
      }

      const gross = salaryRates[role] || 2000; // Base for others
      
      // Get dynamic tax rate from global state
      const globalState = await this.getGlobalState();
      const taxRate = globalState.taxRate || 0.20;
      
      const taxAmount = Math.floor(gross * taxRate);
      const netAmount = gross - taxAmount;

      // Handle card balance update
      let updatedCards = [...(data.bankCards || [])];
      let cardIndex = updatedCards.findIndex(c => c.type === 'standard');
      if (cardIndex === -1 && updatedCards.length > 0) cardIndex = 0;

      if (cardIndex !== -1) {
        updatedCards[cardIndex] = {
          ...updatedCards[cardIndex],
          balance: (Number(updatedCards[cardIndex].balance) || 0) + netAmount
        };
      } else {
        // If no cards, maybe add to global balance if exists, but we use cards now
        if (data.balance !== undefined) {
           await updateDoc(userRef, { balance: (data.balance || 0) + netAmount });
        } else {
           return { success: false, message: 'У вас немає активної карти для отримання зарплати' };
        }
      }

      // 1. Update User
      await updateDoc(userRef, {
        bankCards: updatedCards.length > 0 ? updatedCards : data.bankCards,
        lastPayDay: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 2. Update Budget (Taxes go to global budget)
      const newBudget = (globalState.budget || 0) + taxAmount;
      await this.updateGlobalState({ budget: newBudget });

      // 3. Send Official Notification Report
      const report = `🏦 Банк: Нарахування заробітної плати
Ви отримали зарплату за останні 15 хвилин роботи.
• Посада: ${role}
• Нараховано: ${gross.toLocaleString()} ₴
• Стягнуто податків (${(taxRate * 100).toFixed(0)}% до Держбюджету): ${taxAmount.toLocaleString()} ₴
• Зараховано на рахунок: ${netAmount.toLocaleString()} ₴
Ваш поточний баланс: ${updatedCards[cardIndex]?.balance?.toLocaleString() || (data.balance + netAmount).toLocaleString()} ₴
Баланс Державного бюджету: ${newBudget.toLocaleString()} ₴`;

      await this.sendNotification(userId, {
        title: '💰 PayDay: Зарплата',
        message: report,
        type: 'success'
      });

      return { success: true, netAmount, taxAmount };
    } catch (error) {
      console.error('PayDay Error:', error);
      return { success: false, error };
    }
  }

  async distributeSocialSupport(amountPerPlayer: number, type: 'support' | 'pension' = 'support') {
    try {
      const { collection, getDocs, writeBatch, doc, getDoc, query, where, documentId } = await import('firebase/firestore');
      
      // 1. Get online user IDs from presence
      const presenceSnapshot = await getDocs(collection(db, 'presence'));
      const onlineUids = presenceSnapshot.docs.map(d => d.id);
      
      if (onlineUids.length === 0) return { success: true, count: 0, message: 'Немає гравців в мережі (онлайн)' };

      // 2. Fetch only online users from the users collection
      // Firestore 'in' query limit is 30, so we might need chunks if there are many online
      let onlineUsers: any[] = [];
      const usersRef = collection(db, 'users');
      
      // Chunking for Firestore 'in' query limit (30)
      for (let i = 0; i < onlineUids.length; i += 30) {
        const chunk = onlineUids.slice(i, i + 30);
        const q = query(usersRef, where(documentId(), 'in', chunk));
        const snap = await getDocs(q);
        onlineUsers = [...onlineUsers, ...snap.docs];
      }

      if (onlineUsers.length === 0) return { success: true, count: 0, message: 'Не знайдені профілі онлайн-гравців' };
      
      const targetCardType = type === 'support' ? 'e-support' : 'pension';
      let count = 0;
      const batch = writeBatch(db);

      onlineUsers.forEach((userDoc) => {
        const data = userDoc.data();
        let cardIndex = -1;
        let updatedCards = [];

        // Check for new array format
        if (data.bankCards && Array.isArray(data.bankCards)) {
          cardIndex = data.bankCards.findIndex((c: any) => c.type === targetCardType);
          updatedCards = [...data.bankCards];
        } 
        // Fallback for legacy single card format
        else if (data.bankCard && data.bankCard.type === targetCardType) {
          cardIndex = 0;
          updatedCards = [data.bankCard];
        }
        
        if (cardIndex !== -1) {
          const userRef = userDoc.ref;
          updatedCards[cardIndex] = {
            ...updatedCards[cardIndex],
            balance: (Number(updatedCards[cardIndex].balance) || 0) + amountPerPlayer
          };
          
          const updates: any = {
            bankCards: updatedCards,
            updatedAt: serverTimestamp()
          };
          
          if (data.bankCard) updates.bankCard = null; // Cleanup legacy field
          
          batch.update(userRef, updates);

          // Add notification
          const notificationRef = doc(collection(db, 'notifications'));
          batch.set(notificationRef, {
            userId: userDoc.id,
            title: targetCardType === 'e-support' ? 'Є-Підтримка 🇺🇦' : 'Пенсійний Фонд 🎖️',
            message: `На вашу карту ${targetCardType === 'e-support' ? 'Є-Підтримка' : 'Пенсійна'} зараховано державну виплату у розмірі ₴${amountPerPlayer.toLocaleString()}`,
            type: 'success',
            read: false,
            createdAt: serverTimestamp()
          });

          count++;
        }
      });

      if (count === 0) return { success: true, count: 0, message: 'Немає громадян з відповідними картами для виплати' };

      const totalCost = count * amountPerPlayer;
      
      // Atomic budget check and subtraction in the same batch (via getDoc first then batch.update)
      const budgetRef = doc(db, 'system', 'global');
      const budgetSnap = await getDoc(budgetRef);
      
      if (!budgetSnap.exists()) return { success: false, error: { message: 'Глобальний стан не знайдено' } };
      
      const currentBudget = budgetSnap.data().budget || 0;
      if (currentBudget < totalCost) {
        return { success: false, error: { message: `Недостатньо коштів у бюджеті! Текучий бюджет: ₴${currentBudget.toLocaleString()}, необхідно: ₴${totalCost.toLocaleString()}` } };
      }

      // Add budget update to the batch
      batch.update(budgetRef, {
        budget: currentBudget - totalCost,
        updatedAt: serverTimestamp()
      });

      // Commit everything
      await batch.commit();
      return { success: true, count };
    } catch (error) {
      console.error('Error distributing social support:', error);
      return { success: false, error: error instanceof Error ? error : { message: String(error) } };
    }
  }

  async saveProfile(profile: any) {
    const path = `users/${profile.uid}`;
    try {
      const { serverTimestamp } = await import('firebase/firestore');
      
      const updateData: any = {
        ...profile,
        updatedAt: serverTimestamp(),
        lastActive: serverTimestamp()
      };

      // Set createdAt ONLY if not present
      if (!profile.createdAt) {
          updateData.createdAt = serverTimestamp();
      }

      await setDoc(doc(db, 'users', profile.uid), updateData, { merge: true });
      return { success: true };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  async getProfile(uid: string, userOverride?: any) {
    if (!uid || typeof uid !== 'string' || uid.length < 3) {
      console.warn("getProfile called with invalid UID:", uid);
      return null;
    }
    const path = `users/${uid}`;
    try {
      const docSnap = await getDoc(doc(db, path));
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          taxDebt: 0,
          ...data
        } as any;
      }
      return null;
    } catch (error) {
      // Pass userOverride if available to help identify the caller in logs
      handleFirestoreError(error, OperationType.GET, path, userOverride);
      return null;
    }
  }

  async searchUsers(queryStr: string) {
    const path = 'users';
    try {
      // Simple search mock
      const q = query(collection(db, path));
      const querySnapshot = await getDocs(q);
      const users = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return users.filter((u: any) => 
        u.firstName?.toLowerCase().includes(queryStr.toLowerCase()) || 
        u.lastName?.toLowerCase().includes(queryStr.toLowerCase())
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  }

  async getChatHistory() {
    const path = 'messages';
    try {
      const q = query(collection(db, path));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  }
  
  async transferMoney(fromId: string, toId: string, amount: number) {
    try {
      await runTransaction(db, async (transaction) => {
        const fromRef = doc(db, 'users', fromId);
        const toRef = doc(db, 'users', toId);
        
        const fromSnap = await transaction.get(fromRef);
        const toSnap = await transaction.get(toRef);
        
        if (!fromSnap.exists() || !toSnap.exists()) {
          throw new Error("Один або обоє гравців не знайдені");
        }
        
        const fromData = fromSnap.data();
        if (fromData.balance < amount) {
          throw new Error("Недостатньо коштів");
        }
        
        transaction.update(fromRef, { balance: fromData.balance - amount, updatedAt: serverTimestamp() });
        transaction.update(toRef, { balance: (toSnap.data().balance || 0) + amount, updatedAt: serverTimestamp() });
      });
      return { success: true };
    } catch (error: any) {
      return { error: error.message };
    }
  }

  async payTax(uid: string, amount: number) {
    const userRef = doc(db, 'users', uid);
    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("Користувача не знайдено");
        
        const data = userDoc.data();
        const currentBalance = data.balance || 0;
        const currentDebt = data.taxDebt || 0;
        
        if (currentBalance < amount) throw new Error("Недостатньо коштів на балансі");
        
        const payAmount = Math.min(amount, currentDebt);
        if (payAmount <= 0) throw new Error("У вас немає заборгованості");

        transaction.update(userRef, {
          balance: currentBalance - payAmount,
          taxDebt: currentDebt - payAmount,
          updatedAt: serverTimestamp()
        });
      });
      return { success: true };
    } catch (error: any) {
      return { error: error.message };
    }
  }

  async getAdminUsers() {
    const path = 'users';
    try {
      const querySnapshot = await getDocs(collection(db, path));
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  }

  async adminUpdateUser(uid: string, fields: any, adminName: string) {
    const path = `users/${uid}`;
    try {
      const userSnap = await getDoc(doc(db, path));
      if (userSnap.exists() && userSnap.data().email === 'ukrainerp67@gmail.com') {
        throw new Error('Неможливо змінити профіль Головного Адміністратора');
      }

      await updateDoc(doc(db, path), {
        ...fields,
        updatedAt: serverTimestamp()
      });
      
      // If balance changed, log it or notify
      if (fields.balance !== undefined) {
         this.sendNotification(uid, {
           title: 'Фінансова операція',
           message: `Адміністратор ${adminName} змінив ваш баланс. Новий баланс: ₴${fields.balance.toLocaleString()}`,
           type: 'money'
         });
      }

      return { success: true };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async adminMuteUser(uid: string, durationMinutes: number, reason: string, adminName: string) {
    const path = `users/${uid}`;
    const muteUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
    try {
      const userSnap = await getDoc(doc(db, path));
      if (userSnap.exists() && userSnap.data().email === 'ukrainerp67@gmail.com') {
        throw new Error('Головий Адміністратор має імунітет до муту');
      }

      await updateDoc(doc(db, path), {
        muteUntil: muteUntil.toISOString(),
        muteReason: reason,
        updatedAt: serverTimestamp()
      });

      this.sendNotification(uid, {
        title: 'Блокування чату',
        message: `Ви отримали мут на ${durationMinutes} хв. Причина: ${reason}. Адмін: ${adminName}`,
        type: 'error'
      });

      return { success: true };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async adminFreezeUser(uid: string, durationMinutes: number, reason: string, adminName: string) {
    const path = `users/${uid}`;
    // -1 means permanent
    const freezeUntil = durationMinutes === -1 ? 'permanent' : new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
    
    try {
      const userSnap = await getDoc(doc(db, path));
      if (userSnap.exists() && userSnap.data().email === 'ukrainerp67@gmail.com') {
        throw new Error('Головний Адміністратор має імунітет до заморозки');
      }

      await updateDoc(doc(db, path), {
        isFrozen: true,
        freezeUntil,
        freezeReason: reason,
        updatedAt: serverTimestamp()
      });

      this.sendNotification(uid, {
        title: 'Акаунт Заморожено ❄️',
        message: `Адміністратор ${adminName} заморозив ваш акаунт ${durationMinutes === -1 ? 'назавжди' : `на ${durationMinutes} хв`}. Причина: ${reason}. Всі функції обмежені.`,
        type: 'error'
      });

      return { success: true };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async adminUnfreezeUser(uid: string, adminName: string) {
    const path = `users/${uid}`;
    try {
      await updateDoc(doc(db, path), {
        isFrozen: false,
        freezeUntil: null,
        freezeReason: null,
        updatedAt: serverTimestamp()
      });

      this.sendNotification(uid, {
        title: 'Акаунт Розморожено ✨',
        message: `Адміністратор ${adminName} розморозив ваш акаунт. Приємної гри!`,
        type: 'success'
      });

      return { success: true };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async adminDeleteUser(uid: string) {
    const path = `users/${uid}`;
    try {
      const userSnap = await getDoc(doc(db, path));
      if (userSnap.exists() && userSnap.data().email === 'ukrainerp67@gmail.com') {
        throw new Error('Неможливо видалити акаунт Головного Адміністратора');
      }

      await deleteDoc(doc(db, path));
      // Also cleanup presence
      await deleteDoc(doc(db, 'presence', uid));
      return { success: true };
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  async sendNotification(userId: string, notification: { title: string, message: string, type: string }) {
    const path = 'notifications';
    try {
      await addDoc(collection(db, path), {
        userId,
        ...notification,
        read: false,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  onAdminUsersUpdate(callback: (users: any[]) => void) {
    const path = 'users';
    return onSnapshot(collection(db, path), (snapshot) => {
      const users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
      callback(users);
    }, (error) => {
      console.warn("Admin users snapshot error", error);
    });
  }

  async getAdminStats() {
    const path = 'users';
    try {
      const querySnapshot = await getDocs(collection(db, path));
      const users = querySnapshot.docs.map(doc => doc.data());
      
      const totalPlayers = users.length;
      const totalEconomy = users.reduce((acc, u) => acc + (u.balance || 0), 0);
      const avgSocialRating = users.length > 0 ? users.reduce((acc, u) => acc + (u.socialRating || 0), 0) / users.length : 0;
      
      // Online check based on presence (users active in last 5 mins)
      const fiveMinsAgo = Date.now() - 5 * 60 * 1000;
      const onlineNow = users.filter(u => u.lastActive?.toMillis ? u.lastActive.toMillis() > fiveMinsAgo : false).length;

      return {
        totalPlayers,
        totalEconomy,
        onlineNow,
        avgSocialRating
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  }

  onPlayersUpdate(callback: (players: any[]) => void) {
    this.playersUpdateCallback = callback;
    this.setupPresence();
    return () => {
      this.playersUpdateCallback = null;
      if (this.presenceUnsubscribe) {
        this.presenceUnsubscribe();
        this.presenceUnsubscribe = null;
      }
    };
  }

  onNewMessage(callback: (msg: any) => void) {
    this.messageCallback = callback;
    
    if (this.messagesUnsubscribe) return;

    onAuthStateChanged(auth, (user) => {
        if (user) {
            const q = query(collection(db, 'messages'));
            this.messagesUnsubscribe = onSnapshot(q, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === "added") {
                        callback({ id: change.doc.id, ...change.doc.data() });
                    }
                });
            }, (error) => {
                console.warn("Messages snapshot error - likely unauth", error);
            });
        } else {
            if (this.messagesUnsubscribe) {
                this.messagesUnsubscribe();
                this.messagesUnsubscribe = null;
            }
        }
    });
  }

  joinGame(playerData: any) {
    // Presence is handled automatically in setupPresence
  }

  sendMessage(msg: any) {
    const path = 'messages';
    addDoc(collection(db, path), {
      ...msg,
      createdAt: serverTimestamp()
    }).catch(e => handleFirestoreError(e, OperationType.CREATE, path));
  }

  disconnect() {
    // Cleanup handled in onPlayersUpdate return
  }
}

export const backend = new BackendService();
