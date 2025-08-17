// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// Serve static client files
app.use(express.static(path.join(__dirname, "public")));

const users = new Map(); // socket.id -> { name }

function timeNow() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

io.on("connection", (socket) => {
  // client sẽ gửi tên random ngay khi connect
  socket.on("hello", (name) => {
    users.set(socket.id, { name });
    io.emit("sys", { type: "join", name, at: timeNow(), online: users.size });
  });

  socket.on("chat", (msg) => {
    const user = users.get(socket.id);
    if (!user) return;
    const trimmed = (msg || "").toString().slice(0, 500); // chặn spam dài
    if (!trimmed.trim()) return;
    io.emit("chat", {
      name: user.name,
      message: trimmed,
      at: timeNow(),
      id: socket.id
    });
  });

  socket.on("typing", (isTyping) => {
    const user = users.get(socket.id);
    if (!user) return;
    socket.broadcast.emit("typing", { name: user.name, isTyping: !!isTyping });
  });

  socket.on("disconnect", () => {
    const user = users.get(socket.id);
    users.delete(socket.id);
    if (user) {
      io.emit("sys", { type: "leave", name: user.name, at: timeNow(), online: users.size });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server started on http://localhost:" + PORT);
});