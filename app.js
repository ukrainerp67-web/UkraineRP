import { createServer } from "http";
import express from "express";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// This file is a compiled-like version of server.ts for production environments like cPanel
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const JWT_SECRET = process.env.JWT_SECRET || "ukraine-rp-secret-key-123";

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const usersPath = path.join(DATA_DIR, "users.json");
const messagesPath = path.join(DATA_DIR, "messages.json");

let players = new Map();
let messages = [];

const getUsers = () => {
    if (!fs.existsSync(usersPath)) return [];
    try {
        return JSON.parse(fs.readFileSync(usersPath, "utf-8"));
    } catch (e) {
        return [];
    }
};

const saveUsers = (users) => {
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
};

if (fs.existsSync(messagesPath)) {
  try {
    messages = JSON.parse(fs.readFileSync(messagesPath, "utf-8"));
  } catch (e) {
    messages = [];
  }
}

app.post("/api/auth/register", async (req, res) => {
  const { email, password } = req.body;
  const users = getUsers();
  if (users.find((u) => u.email === email)) return res.status(400).json({ error: "User already exists" });
  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = { uid: Math.random().toString(36).substring(7), email, password: hashedPassword, createdAt: new Date().toISOString() };
  users.push(newUser);
  saveUsers(users);
  const token = jwt.sign({ uid: newUser.uid, email: newUser.email }, JWT_SECRET);
  res.json({ token, user: { uid: newUser.uid, email: newUser.email } });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const users = getUsers();
  const user = users.find((u) => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: "Invalid credentials" });
  const token = jwt.sign({ uid: user.uid, email: user.email }, JWT_SECRET);
  res.json({ token, user: { uid: user.uid, email: user.email } });
});

app.post("/api/profile/save", (req, res) => {
  const profile = req.body;
  const filePath = path.join(DATA_DIR, `profile_${profile.uid}.json`);
  fs.writeFileSync(filePath, JSON.stringify(profile, null, 2));
  res.json({ success: true });
});

app.get("/api/profile/:uid", (req, res) => {
  const filePath = path.join(DATA_DIR, `profile_${req.params.uid}.json`);
  if (fs.existsSync(filePath)) {
    res.json(JSON.parse(fs.readFileSync(filePath, "utf-8")));
  } else {
    res.status(404).json({ error: "Profile not found" });
  }
});

app.get("/api/chat/history", (req, res) => res.json(messages.slice(-50)));

app.get("/api/users/search", (req, res) => {
    const query = (req.query.q || "").toLowerCase();
    const files = fs.readdirSync(DATA_DIR);
    const results = [];
    for (const file of files) {
        if (file.startsWith("profile_") && file.endsWith(".json")) {
            const profile = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
            if (`${profile.firstName} ${profile.lastName}`.toLowerCase().includes(query) || profile.uid.includes(query)) {
                results.push({ uid: profile.uid, firstName: profile.firstName, lastName: profile.lastName, passportPhoto: profile.passportPhoto, socialRating: profile.socialRating, balance: profile.balance });
            }
        }
        if (results.length >= 20) break;
    }
    res.json(results);
});

app.post("/api/users/transfer", (req, res) => {
    const { fromId, toId, amount } = req.body;
    const senderFile = path.join(DATA_DIR, `profile_${fromId}.json`);
    const recipientFile = path.join(DATA_DIR, `profile_${toId}.json`);
    if (!fs.existsSync(senderFile) || !fs.existsSync(recipientFile)) return res.status(404).json({ error: "Not found" });
    const senderProfile = JSON.parse(fs.readFileSync(senderFile, 'utf8'));
    const recipientProfile = JSON.parse(fs.readFileSync(recipientFile, 'utf8'));
    if (senderProfile.balance < amount) return res.status(400).json({ error: "Insufficient balance" });
    senderProfile.balance -= amount;
    recipientProfile.balance += amount;
    fs.writeFileSync(senderFile, JSON.stringify(senderProfile, null, 2));
    fs.writeFileSync(recipientFile, JSON.stringify(recipientProfile, null, 2));
    res.json({ success: true, newBalance: senderProfile.balance });
});

app.get("/api/admin/users", (req, res) => {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('profile_'));
    res.json(files.map(f => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'))));
});

app.get("/api/admin/stats", (req, res) => {
    const profiles = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('profile_')).map(f => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')));
    res.json({
        totalPlayers: profiles.length,
        totalEconomy: profiles.reduce((sum, p) => sum + (p.balance || 0), 0),
        avgSocialRating: profiles.length > 0 ? profiles.reduce((sum, p) => sum + (p.socialRating || 0), 0) / profiles.length : 0,
        onlineNow: players.size
    });
});

app.get("/api/health", (req, res) => res.json({ status: "running" }));

// Static files (Vite build)
const distPath = path.join(__dirname, "dist");
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
}

io.on("connection", (socket) => {
  socket.on("join", (playerData) => {
    players.set(socket.id, playerData);
    io.emit("players_update", Array.from(players.values()));
  });

  socket.on("send_message", (msg) => {
    const fullMsg = { ...msg, id: Math.random().toString(36).substring(7), timestamp: new Date().toISOString() };
    messages.push(fullMsg);
    if (messages.length > 200) messages.shift();
    fs.writeFileSync(messagesPath, JSON.stringify(messages));
    io.emit("new_message", fullMsg);
  });

  socket.on("disconnect", () => {
    players.delete(socket.id);
    io.emit("players_update", Array.from(players.values()));
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server started on port ${PORT}`);
});
