import { io, Socket } from "socket.io-client";

const API_URL = window.location.origin;

class BackendService {
  private socket: Socket | null = null;
  private token: string | null = localStorage.getItem("token");

  constructor() {
    this.socket = io(API_URL);
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
        localStorage.setItem("token", token);
    } else {
        localStorage.removeItem("token");
    }
  }

  getToken() {
    return this.token;
  }

  async login(credentials: any) {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    const data = await response.json();
    if (data.token) {
        this.setToken(data.token);
    }
    return data;
  }

  async register(credentials: any) {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    const data = await response.json();
    if (data.token) {
        this.setToken(data.token);
    }
    return data;
  }

  async saveProfile(profile: any) {
    const response = await fetch(`${API_URL}/api/profile/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    return response.json();
  }

  async getProfile(uid: string) {
    const response = await fetch(`${API_URL}/api/profile/${uid}`);
    if (!response.ok) return null;
    return response.json();
  }

  async searchUsers(query: string) {
    const response = await fetch(`${API_URL}/api/users/search?q=${encodeURIComponent(query)}`);
    return response.json();
  }

  async getChatHistory() {
    const response = await fetch(`${API_URL}/api/chat/history`);
    return response.json();
  }
  
  async transferMoney(fromId: string, toId: string, amount: number) {
    const response = await fetch(`${API_URL}/api/users/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromId, toId, amount })
    });
    return response.json();
  }

  async getAdminUsers() {
    const response = await fetch(`${API_URL}/api/admin/users`);
    return response.json();
  }

  async adminUpdateUser(uid: string, fields: any) {
    const response = await fetch(`${API_URL}/api/admin/update-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, fields })
    });
    return response.json();
  }

  async getAdminStats() {
    const response = await fetch(`${API_URL}/api/admin/stats`);
    return response.json();
  }

  onPlayersUpdate(callback: (players: any[]) => void) {
    this.socket?.on("players_update", callback);
  }

  onNewMessage(callback: (msg: any) => void) {
    this.socket?.on("new_message", callback);
  }

  joinGame(playerData: any) {
    this.socket?.emit("join", playerData);
  }

  sendMessage(msg: any) {
    this.socket?.emit("send_message", msg);
  }

  disconnect() {
    this.socket?.disconnect();
  }
}

export const backend = new BackendService();
