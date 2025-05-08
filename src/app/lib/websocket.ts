import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from 'http';
import { URLSearchParams } from 'url';

declare global {
    var __globalWssInstance: WebSocketServer | undefined;
}  

let wss: WebSocketServer | null = null;
const clients: Record<string, WebSocket> = {};
const PORT = 3001;

function initializeWebSocketServer(): WebSocketServer {
  console.log("Attempting to initialize WebSocket server...");
  const server = new WebSocketServer({ port: PORT });

  server.on("listening", () => {
    console.log(`[WebSocket] WebSocket server started and listening on port ${PORT}`);
  });

  server.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const requestUrl = req.url || '';
    const queryParams = new URLSearchParams(requestUrl.split('?')[1]);
    const downloadId = queryParams.get('downloadId');

    if (downloadId) {
      clients[downloadId] = ws;
      console.log(`[WebSocket] Client connected with downloadId: ${downloadId}`);

      ws.on("message", (message) => {
        console.log(`[WebSocket] Received message from ${downloadId}: ${message}`);
      });

      ws.on("close", () => {
        delete clients[downloadId];
        console.log(`[WebSocket] Client disconnected with downloadId: ${downloadId}`);
      });

      ws.on("error", (error) => {
        console.error(`[WebSocket] Error for client ${downloadId}:`, error);
        delete clients[downloadId]; // Clean up on error
      });
    } else {
        console.log("[WebSocket] Client connected without a downloadId. Closing connection.");
        ws.close();
    }
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[WebSocket] Error: Port ${PORT} is already in use. Another server instance might be running.`);
    } else {
      console.error("[WebSocket] Server Error:", error);
    }
    if (wss === server) {
      wss = null;
    }
  });

  return server;
}

if (process.env.NODE_ENV === 'production') {
  if (!wss) {
    wss = initializeWebSocketServer();
  }
} else {
  if (!global.__globalWssInstance) {
    console.log("[WebSocket] Creating new server instance for development.");
    global.__globalWssInstance = initializeWebSocketServer();
  } else {
    console.log("[WebSocket] Re-using existing server instance from global for development.");
  }
  wss = global.__globalWssInstance;
}

if (!wss) {
  console.error("[WebSocket] Critical Error: WebSocket server instance (wss) is null after initialization attempts.");
}

export function ensureWebSocketServerRunning() {
  if (!wss) {
    console.warn("[WebSocket] ensureWebSocketServerRunning called, but server instance is not available. This might indicate an issue in initialization.");
    throw new Error("WebSocket server is not initialized.");
  }
}

export function sendProgress(id: string, message: string, extra: Record<string, unknown> = {}) {
  if (!wss) {
    console.error("[WebSocket] sendProgress: WebSocket server not initialized. Cannot send message.");
    return;
  }
  const ws = clients[id];
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ message, ...extra }));
  } else {
    console.log(`[WebSocket] Client ${id} not found or not open. Message not sent: ${message}`);
  }
}

export function getWebSocketClientCount(): number {
  if (!wss) {
    return 0;
  }
  return Object.keys(clients).length;
}
