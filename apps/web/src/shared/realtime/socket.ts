import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

// Single shared connection, authorized with the verified Telegram initData.
export function getSocket(): Socket {
  if (!socket) {
    const initData = window.Telegram?.WebApp.initData ?? '';
    socket = io({ auth: { initData } });
  }
  return socket;
}
