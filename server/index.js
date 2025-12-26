import crypto from "crypto";
import fs from "fs";
import https from "https";
import http from "http";
import { URL } from "url";
import { WebSocketServer, WebSocket } from "ws";
import client from "prom-client";
import { api } from "./api.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...values] = trimmed.split('=');
      if (key && values.length) {
        process.env[key.trim()] = values.join('=').trim();
      }
    }
  });
  console.log('Loaded .env file with DISCORD_CLIENT_ID:', process.env.DISCORD_CLIENT_ID ? 'present' : 'missing');
}

const register = new client.Registry();
register.setDefaultLabels({
  app: "clocktower-online",
});

const PING_INTERVAL = 30000;
const MAX_BODY_SIZE = 1024 * 100;

const options = {};

if (process.env.NODE_ENV !== "development") {
  options.cert = fs.readFileSync(
    "/etc/letsencrypt/live/clocktower.live/fullchain.pem",
  );
  options.key = fs.readFileSync(
    "/etc/letsencrypt/live/clocktower.live/privkey.pem",
  );
}

const requestHandler = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  
  if (url.pathname === '/auth/discord') {
    const response = await api.discordOAuth(req);
    if (response.headers?.Location) {
      res.writeHead(response.status || 302, response.headers);
      res.end();
      return;
    }
  } else if (url.pathname === '/auth/discord/callback') {
    const response = await api.discordCallback(req);
    res.writeHead(response.status || 200, { 'Content-Type': 'application/json' });
    const body = await response.text();
    res.end(body);
    return;
  }
  
  if (url.pathname.startsWith('/api/')) {
    const path = url.pathname.slice(5); // Remove '/api/'
    
    try {
      let response;
      
      if (path === 'session/create' && req.method === 'POST') {
        response = await api.createSession(req);
      } else if (path === 'session/update-discord' && req.method === 'POST') {
        response = await api.updateSessionDiscordUser(req);
      } else if (path === 'game/start' && req.method === 'POST') {
        response = await api.startGame(req);
      } else if (path === 'game/end' && req.method === 'POST') {
        response = await api.endGame(req);
      } else if (path === 'player/add' && req.method === 'POST') {
        response = await api.addPlayer(req);
      } else if (path === 'player/death' && req.method === 'POST') {
        response = await api.addDeath(req);
      } else if (path === 'timer/start' && req.method === 'POST') {
        response = await api.timerStart(req);
      } else if (path === 'timer/stop' && req.method === 'POST') {
        response = await api.timerStop(req);
      } else if (path === 'timer/pause' && req.method === 'POST') {
        response = await api.timerPause(req);
      } else if (path === 'timer/resume' && req.method === 'POST') {
        response = await api.timerResume(req);
      } else if (path === 'mute' && req.method === 'POST') {
        response = await api.mute(req);
      } else if (path === 'unmute' && req.method === 'POST') {
        response = await api.unmute(req);
      } else if (path.startsWith('stats/game/') && req.method === 'GET') {
        const gameId = path.split('/')[2];
        response = api.getGameStats(req, gameId);
      } else {
        response = Response.json({ error: 'Not found' }, { status: 404 });
      }
      
      res.writeHead(response.status || 200, { 'Content-Type': 'application/json' });
      const body = await response.text();
      res.end(body);
    } catch (error) {
      console.error('API error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
    return;
  }
  
  res.writeHead(404);
  res.end('Not Found');
};

const server = process.env.NODE_ENV === "development"
  ? http.createServer(requestHandler)
  : https.createServer(options, requestHandler);

if (process.env.NODE_ENV === "development") {
  server.listen(8001, () => {
    console.log('HTTP server listening on port 8001 (development mode)');
  });
}

const wss = new WebSocketServer({
  server,
  verifyClient: (info) =>
    info.origin &&
    !!info.origin.match(
      /^https?:\/\/([^.]+\.github\.io|[^.]+\.pages\.dev|localhost|clocktower\.live|grim\.hystericca\.dev)/i,
    ),
});

console.log(`WebSocket server starting in ${process.env.NODE_ENV || 'production'} mode...`);
console.log(`Port: ${process.env.NODE_ENV === "development" ? "8001" : "8001 (via HTTPS server)"}`);

function noop() {}

function heartbeat() {
  this.latency = Math.round((new Date().getTime() - this.pingStart) / 2);
  this.counter = 0;
  this.isAlive = true;
}

const channels = {};

const metrics = {
  players_concurrent: new client.Gauge({
    name: "players_concurrent",
    help: "Concurrent Players",
    collect() {
      this.set(wss.clients.size);
    },
  }),
  channels_concurrent: new client.Gauge({
    name: "channels_concurrent",
    help: "Concurrent Channels",
    collect() {
      this.set(Object.keys(channels).length);
    },
  }),
  channels_list: new client.Gauge({
    name: "channel_players",
    help: "Players in each channel",
    labelNames: ["name"],
    collect() {
      for (let channel in channels) {
        this.set(
          { name: channel },
          channels[channel].filter(
            (ws) =>
              ws &&
              (ws.readyState === WebSocket.OPEN ||
                ws.readyState === WebSocket.CONNECTING),
          ).length,
        );
      }
    },
  }),
  messages_incoming: new client.Counter({
    name: "messages_incoming",
    help: "Incoming messages",
  }),
  messages_outgoing: new client.Counter({
    name: "messages_outgoing",
    help: "Outgoing messages",
  }),
  connection_terminated_host: new client.Counter({
    name: "connection_terminated_host",
    help: "Terminated connection due to host already present",
  }),
  connection_terminated_spam: new client.Counter({
    name: "connection_terminated_spam",
    help: "Terminated connection due to message spam",
  }),
  connection_terminated_timeout: new client.Counter({
    name: "connection_terminated_timeout",
    help: "Terminated connection due to timeout",
  }),
  connection_terminated_player_validate: new client.Counter({
    name: "connection_terminated_player_validate",
    help: "Terminated connection due to player validation failure",
  }),
};

for (let metric in metrics) {
  register.registerMetric(metrics[metric]);
}

wss.on("connection", function connection(ws, req) {
  const url = new URL(req.url, "wss://clocktower.live/");
  [ws.channel, ws.playerId] = url.pathname
    .replace(/^\//, "")
    .split("/")
    .map((c) => decodeURIComponent(c));
  ws.channel = ws.channel.toLowerCase();
  if (
    ws.playerId === "host" &&
    channels[ws.channel] &&
    channels[ws.channel].some(
      (client) =>
        client !== ws &&
        client.readyState === WebSocket.OPEN &&
        client.playerId === "host",
    )
  ) {
    console.log(ws.channel, "duplicate host");
    ws.close(1000, `The channel "${ws.channel}" already has a host`);
    metrics.connection_terminated_host.inc();
    return;
  }
  // Validate the player ID to confirm it's not an impersonation.
  if (ws.playerId && ws.playerId.indexOf("__s_") === 0) {
    let correctPlayerId;
    let rawSecret = url.searchParams.get("secret");
    if (rawSecret) {
      let playerSecret = new Uint8Array(Buffer.from(rawSecret, "base64url"));
      const digestInput = new Uint8Array([
        155,
        113,
        7,
        193,
        229,
        225,
        124,
        147,
        153,
        27,
        254,
        60,
        164,
        234,
        108,
        10,
        ...playerSecret,
      ]);
      correctPlayerId =
        "__s_" +
        crypto.createHash("sha256").update(digestInput).digest("base64url");
    }
    if (ws.playerId !== correctPlayerId) {
      console.log(
        ws.channel,
        ws.playerId,
        ws._socket?.remoteAddress || 'unknown',
        "possible player impersonation rejected",
      );
      ws.close(1000, "Player secret failed to validate.");
      metrics.connection_terminated_player_validate.inc();
      return;
    }
  }
  ws.isAlive = true;
  ws.pingStart = new Date().getTime();
  ws.counter = 0;
  if (!channels[ws.channel]) {
    channels[ws.channel] = [];
  }
  channels[ws.channel].push(ws);
  ws.ping(noop);
  ws.on("pong", heartbeat);
  ws.on("close", function close() {
    if (channels[ws.channel]) {
      channels[ws.channel] = channels[ws.channel].filter(client => client !== ws);
      if (channels[ws.channel].length === 0) {
        metrics.channels_list.remove({ name: ws.channel });
        delete channels[ws.channel];
      }
    }
  });
  ws.on("message", function incoming(data) {
    metrics.messages_incoming.inc();
    ws.counter++;
    if (ws.counter > (5 * PING_INTERVAL) / 1000) {
      console.log(ws.channel, "disconnecting user due to spam");
      ws.close(
        1000,
        "Your app seems to be malfunctioning, please clear your browser cache.",
      );
      metrics.connection_terminated_spam.inc();
      return;
    }
    const message = data.toString();
    const messageType = message.toLocaleLowerCase().substr(1).split(",", 1).pop();
    switch (messageType) {
      case '"ping"':
        channels[ws.channel].forEach(function each(client) {
          if (
            client !== ws &&
            client.readyState === WebSocket.OPEN &&
            (ws.playerId === "host" || client.playerId === "host")
          ) {
            client.send(
              message.replace(
                /latency/,
                (client.latency || 0) + (ws.latency || 0),
              ),
            );
            metrics.messages_outgoing.inc();
          }
        });
        break;
      case '"direct"':
        console.log(
          new Date(),
          wss.clients.size,
          ws.channel,
          ws.playerId,
          ws._socket?.remoteAddress || 'unknown',
          message,
        );
        try {
          const dataToPlayer = JSON.parse(message)[1];
          channels[ws.channel].forEach(function each(client) {
            if (
              client !== ws &&
              client.readyState === WebSocket.OPEN &&
              dataToPlayer[client.playerId]
            ) {
              client.send(JSON.stringify(dataToPlayer[client.playerId]));
              metrics.messages_outgoing.inc();
            }
          });
        } catch (e) {
          console.log("error parsing direct message JSON", e);
        }
        break;
      default:
        console.log(
          new Date(),
          wss.clients.size,
          ws.channel,
          ws.playerId,
          message,
        );
        channels[ws.channel].forEach(function each(client) {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(message);
            metrics.messages_outgoing.inc();
          }
        });
        break;
    }
  });
});

const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) {
      metrics.connection_terminated_timeout.inc();
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.pingStart = new Date().getTime();
    ws.ping(noop);
  });
  for (let channel in channels) {
    if (
      !channels[channel].length ||
      !channels[channel].some(
        (ws) =>
          ws &&
          (ws.readyState === WebSocket.OPEN ||
            ws.readyState === WebSocket.CONNECTING),
      )
    ) {
      metrics.channels_list.remove({ name: channel });
      delete channels[channel];
    }
  }
}, PING_INTERVAL);

wss.on("close", function close() {
  clearInterval(interval);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server gracefully...');
  wss.close(() => {
    console.log('WebSocket server closed');
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server gracefully...');
  wss.close(() => {
    console.log('WebSocket server closed');
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });
});

if (process.env.NODE_ENV !== "development") {
  console.log("server starting");
  server.listen(8001);
  server.on("request", (req, res) => {
    res.setHeader("Content-Type", register.contentType);
    register.metrics().then((out) => res.end(out));
  });
}
