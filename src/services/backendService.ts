import { io, Socket } from "socket.io-client";
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
  deleteDoc
} from 'firebase/firestore';

class BackendService {
  private socket: Socket | null = null;
  private playersUpdateCallback: ((players: any[]) => void) | null = null;
  private messageCallback: ((msg: any) => void) | null = null;

  private presenceUnsubscribe: (() => void) | null = null;
  private messagesUnsubscribe: (() => void) | null = null;

  constructor() {
    // Keep socket for real-time chat if needed
    try {
      this.socket = io(window.location.origin);
    } catch (e) {
      console.warn("Socket.io initialization failed");
    }
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

        // Listen for players
        this.presenceUnsubscribe = onSnapshot(collection(db, 'presence'), (snapshot) => {
      const players = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          if (this.playersUpdateCallback) {
            this.playersUpdateCallback(players);
          }
        }, (error) => {
          console.warn("Presence snapshot error - likely unauth", error);
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
        return docSnap.data();
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

  async adminDeleteUser(uid: string) {
    const path = `users/${uid}`;
    try {
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
    this.socket?.emit("join", playerData);
  }

  sendMessage(msg: any) {
    const path = 'messages';
    addDoc(collection(db, path), {
      ...msg,
      createdAt: serverTimestamp()
    }).catch(e => handleFirestoreError(e, OperationType.CREATE, path));
  }

  disconnect() {
    this.socket?.disconnect();
  }
}

export const backend = new BackendService();
