import { io } from "socket.io-client";

const isDev = import.meta.env.DEV;
const SOCKET_URL = isDev ? "/" : "https://chosung-game.onrender.com";

export const socket = io(SOCKET_URL, {
  transports: ["websocket"],
  withCredentials: true,
  autoConnect: false,
});
