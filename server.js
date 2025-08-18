// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const fetch = (...args) => import("node-fetch").then(({default: f}) => f(...args));

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// ---------- Simple JSON storage ----------
const DATA_DIR = path.join(__dirname, "data");
const MSG_PATH = path.join(DATA_DIR, "messages.json");
const USER_PATH = path.join(DATA_DIR, "users.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

function loadJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, "utf8") || ""); } catch { return fallback; }
}
function saveJSON(p, data) {
  try { fs.writeFileSync(p, JSON.stringify(data, null, 2)); } catch {}
}

let messages = loadJSON(MSG_PATH, []);          // [{id, clientId, name, message, at, reactions, senderSocket}]
let usersByClientId = loadJSON(USER_PATH, {});  // { clientId: { name } }
let msgCounter = messages.reduce((m, x) => Math.max(m, x.id || 0), 0);

// ---------- Time & Weather ----------
function timeNow() {
  // Asia/Ho_Chi_Minh ~ GMT+7
  return new Date().toLocaleTimeString("vi-VN", {
    hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh"
  });
}

// Weather (Hà Nội)
let weather = { icon: "⛅", label: "Nhiều mây" };
const WMAP = {
  // Open-Meteo weather_code → emoji + label
  0: ["☀️","Nắng"], 1: ["🌤️","Ít mây"], 2: ["⛅","Nhiều mây"],
  3: ["☁️","U ám"], 45:["🌫️","Sương mù"], 48:["🌫️","Sương đọng"],
  51:["🌦️","Mưa phùn nhẹ"], 53:["🌦️","Mưa phùn"], 55:["🌧️","Mưa phùn to"],
  56:["🌧️","Mưa phùn lạnh"], 57:["🌧️","Mưa phùn lạnh to"],
  61:["🌦️","Mưa nhẹ"], 63:["🌧️","Mưa vừa"], 65:["🌧️","Mưa to"],
  66:["🌧️","Mưa lạnh nhẹ"], 67:["🌧️","Mưa lạnh to"],
  71:["🌨️","Tuyết nhẹ"], 73:["🌨️","Tuyết"], 75:["❄️","Tuyết to"],
  80:["🌦️","Mưa rào nhẹ"], 81:["🌧️","Mưa rào"], 82:["⛈️","Mưa rào to"],
  95:["⛈️","Giông bão"], 96:["⛈️","Giông có mưa đá"], 99:["⛈️","Giông có mưa đá to"]
};
async function refreshWeather() {
  try {
    // Hà Nội: lat 21.0245, lon 105.8412
    const url = "https://api.open-meteo.com/v1/forecast?latitude=21.0245&longitude=105.8412&current=weather_code";
    const r = await fetch(url);
    const j = await r.json();
    const code = j?.current?.weather_code;
    const [icon, label] = WMAP[code] || ["⛅", "Nhiều mây"];
    weather = { icon, label, code };
    io.emit("weather", weather);
  } catch {
    // giữ weather cũ nếu lỗi
  }
}
refreshWeather();
setInterval(refreshWeather, 10 * 60 * 1000); // cập nhật mỗi 10 phút

// ---------- Socket.IO ----------
const socketsToClientId = new Map(); // socket.id -> clientId

io.on("connection", (socket) => {
  // client gửi 'hello' với clientId & optional name
  socket.on("hello", ({ clientId, name }) => {
    if (!clientId) return;

    // lấy/khởi tạo tên người dùng theo clientId
    let record = usersByClientId[clientId];
    if (!record) {
      const animals = ["Tiger","Panda","Eagle","Fox","Dolphin","Falcon","Otter","Koala","Orca","Lynx","Wolf","Hawk","Bison","Seal","Koi","Crane","Drake","Cat","Mantis","Owl"];
      const n = Math.floor(Math.random()*900)+100;
      record = { name: name && name.trim() ? name.trim() : `Guest-${animals[Math.floor(Math.random()*animals.length)]}-${n}` };
      usersByClientId[clientId] = record;
      saveJSON(USER_PATH, usersByClientId);
    } else if (name && name.trim() && name.trim() !== record.name) {
      record.name = name.trim();
      saveJSON(USER_PATH, usersByClientId);
    }

    socketsToClientId.set(socket.id, clientId);

    // gửi init (lịch sử + info + weather)
    socket.emit("init", {
      me: { id: socket.id, clientId, name: record.name },
      weather,
      messages
    });

    // thông báo join + số online
    io.emit("sys", { type: "join", name: record.name, at: timeNow(), online: io.engine.clientsCount });
  });

  // chat
  socket.on("chat", (text) => {
    const clientId = socketsToClientId.get(socket.id);
    if (!clientId) return;
    const name = usersByClientId[clientId]?.name || "Guest";
    const message = (text || "").toString().slice(0, 500).trim();
    if (!message) return;

    const msg = {
      id: ++msgCounter,
      clientId,
      sender: socket.id,
      name,
      message,
      at: timeNow(),
      reactions: {}
    };
    messages.push(msg);
    if (messages.length > 500) messages = messages.slice(-500);
    saveJSON(MSG_PATH, messages);

    io.emit("chat", msg);
  });

  // thả cảm xúc
  socket.on("react", ({ msgId, emoji }) => {
    const clientId = socketsToClientId.get(socket.id);
    if (!clientId) return;
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    if (emoji) msg.reactions[clientId] = emoji;
    else delete msg.reactions[clientId];

    saveJSON(MSG_PATH, messages);
    io.emit("updateMsg", { id: msgId, reactions: msg.reactions });
  });

  // đổi tên (tùy chọn cho tương lai)
  socket.on("rename", (newName) => {
    const clientId = socketsToClientId.get(socket.id);
    if (!clientId) return;
    if (!newName || !newName.trim()) return;
    usersByClientId[clientId] = { name: newName.trim() };
    saveJSON(USER_PATH, usersByClientId);
    io.emit("sys", { type: "rename", name: newName.trim(), at: timeNow() });
  });

  socket.on("disconnect", () => {
    const clientId = socketsToClientId.get(socket.id);
    socketsToClientId.delete(socket.id);
    const nm = clientId ? usersByClientId[clientId]?.name : null;
    if (nm) io.emit("sys", { type: "leave", name: nm, at: timeNow(), online: io.engine.clientsCount });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running at http://localhost:" + PORT));
