const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const axios = require("axios");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let weatherIcon = "☀️";

// Hà Nội weather (Open-Meteo free API)
async function updateWeather() {
  try {
    const res = await axios.get("https://api.open-meteo.com/v1/forecast?latitude=21.0285&longitude=105.8542&current_weather=true");
    const code = res.data.current_weather.weathercode;
    if ([0].includes(code)) weatherIcon = "☀️";
    else if ([1, 2, 3].includes(code)) weatherIcon = "⛅";
    else if ([45, 48].includes(code)) weatherIcon = "🌫️";
    else if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) weatherIcon = "🌧️";
    else if ([71, 73, 75, 77, 85, 86].includes(code)) weatherIcon = "❄️";
    else weatherIcon = "☁️";
  } catch (e) {
    weatherIcon = "☀️";
  }
}
setInterval(updateWeather, 10 * 60 * 1000);
updateWeather();

io.on("connection", (socket) => {
  socket.on("chat message", (msg) => {
    const time = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    io.emit("chat message", { ...msg, time, weather: weatherIcon });
  });
});

server.listen(3000, () => console.log("Server chạy tại http://localhost:3000"));
