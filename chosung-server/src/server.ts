import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { createServer } from "http";
import cors from "cors";
import { Server, Socket } from "socket.io";
import { connectDB } from "./config/db";
import { checkWordDetail } from "./lib/dict";
import { WordModel } from "./models/Word";
import { Chat } from "./models/Chat";
import { randomUUID } from "crypto";
import gameRouter from "./routes/game.routes";
import benchmarkRouter from "./routes/benchmark";
import { getRandomChosungPair } from "./game/chosung";
import { validateWord } from "./game/gameService";
import { MAX_TIME_CHANGE_COUNT } from "./types";
import type { Room, UsedWord, Player, PlayerSnapshot } from "./types";
const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://chosung-game.vercel.app",
      "https://chosung-game.onrender.com",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  }),
);
app.use(express.json());
app.use(benchmarkRouter);

app.get("/", (req, res) => {
  res.status(200).send("OK");
});

app.use("/api", gameRouter);

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://chosung-game.vercel.app",
      "https://chosung-game.onrender.com",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
  allowEIO3: true,
  transports: ["websocket", "polling"],
});

const rooms = new Map<string, Room>();

const isNicknameTaken = (nickname: string) => {
  for (const room of rooms.values()) {
    for (const player of room.players.values()) {
      if (player.nickname === nickname) {
        return true;
      }
    }
  }
  return false;
};

const createRoom = (): { roomId: string; room: Room } => {
  const roomId = randomUUID();
  const room: Room = {
    status: "WAIT",
    players: new Map(),
    chosungPair: getRandomChosungPair(),
    usedWords: new Set<UsedWord>(),
    readyNoticeTimer: undefined,
    startTimer: undefined,
    gameDurationTimer: undefined,
    timeLimit: 60,
    usedTimeChangeCount: 0,
    endAt: undefined,
  };

  rooms.set(roomId, room);
  return { roomId, room };
};

const getRoomBySocket = (socketId: string) => {
  for (const [roomId, room] of rooms.entries()) {
    if (room.players.has(socketId)) {
      return { roomId, room };
    }
  }
  return null;
};

const startGame = (roomId: string, room: Room) => {
  if (room.status === "PLAY") {
    return;
  }

  room.status = "PLAY";
  room.chosungPair = getRandomChosungPair();
  room.usedWords = new Set();

  room.players.forEach((player) => {
    player.score = 0;
  });

  if (room.gameDurationTimer) {
    clearTimeout(room.gameDurationTimer);
    room.gameDurationTimer = undefined;
  }

  const limit = room.timeLimit || 60;
  const durationMs = limit * 1000;
  const syncBuffer = 2500;
  room.endAt = Date.now() + durationMs + syncBuffer;

  io.to(roomId).emit("game-start", {
    chosungPair: room.chosungPair,
    endAt: room.endAt,
  });

  const bufferTime = 3500;

  room.gameDurationTimer = setTimeout(() => {
    const currentRoom = rooms.get(roomId);
    if (!currentRoom || currentRoom.status !== "PLAY") {
      return;
    }

    currentRoom.status = "END";
    currentRoom.gameDurationTimer = undefined;

    const resultsEndAt = Date.now() + 15000;

    const finalScore = Array.from(currentRoom.players.values()).map((p) => ({
      nickname: p.nickname,
      score: p.score,
      socketId: p.socketId,
      isLeaver: false,
    }));

    io.to(roomId).emit("game-end", {
      words: Array.from(currentRoom.usedWords),
      scores: finalScore,
      resultsEndAt,
    });
  }, durationMs + bufferTime);
};

const startCountdown = (
  roomId: string,
  room: Room,
  trigger: "FORCE" | "ALL_READY",
) => {
  if (room.status === "COUNTDOWN" || room.status === "PLAY") return;

  if (room.readyNoticeTimer) clearTimeout(room.readyNoticeTimer);
  if (room.startTimer) clearTimeout(room.startTimer);

  room.status = "COUNTDOWN";

  io.to(roomId).emit("all-ready-notice", { trigger });

  room.readyNoticeTimer = setTimeout(() => {
    room.readyNoticeTimer = undefined;

    io.to(roomId).emit("countdown-start", { seconds: 3 });

    room.startTimer = setTimeout(() => {
      if (room.status === "COUNTDOWN") {
        startGame(roomId, room);
      }
    }, 3000);
  }, 1500);
};

io.on("connection", (socket: Socket) => {
  socket.on("check-nickname", ({ nickname }) => {
    if (!nickname) {
      return socket.emit("nickname-error", {
        message: "닉네임 정보가 없습니다.",
      });
    }

    const trimmedNickname = nickname.trim();
    const nicknameRegex = /^[가-힣a-zA-Z0-9\-_*]{2,8}$/;

    if (!nicknameRegex.test(trimmedNickname)) {
      return socket.emit("nickname-check-result", {
        available: false,
        message: "한글/영문 2~8자, 특수문자(-, _, *)만 가능합니다.",
      });
    }

    const taken = isNicknameTaken(trimmedNickname);

    socket.emit("nickname-check-result", {
      available: !taken,
      nickname: trimmedNickname,
      message: taken
        ? "중복된 닉네임(별호) 입니다."
        : "사용 가능한 닉네임(별호) 입니다.",
    });
  });

  const handleLeaveRoom = async (socket: Socket) => {
    const resultData = getRoomBySocket(socket.id);
    if (!resultData) return;

    const { roomId, room } = resultData;
    const leaverId = socket.id;
    const leaver = room.players.get(leaverId);

    if (!leaver) return;

    room.players.delete(leaverId);

    if (room.players.size > 0) {
      io.to(roomId).emit("receive-chat", {
        socketId: "system",
        nickname: "",
        message: `${leaver.nickname}님이 퇴장하였습니다.`,
        type: "system",
      });
    }
    if (room.status === "COUNTDOWN") {
      if (room.readyNoticeTimer) {
        clearTimeout(room.readyNoticeTimer);
        room.readyNoticeTimer = undefined;
      }
      if (room.startTimer) {
        clearTimeout(room.startTimer);
        room.startTimer = undefined;
      }
      room.status = "WAIT";
      room.players.forEach((p) => (p.isReady = false));
      io.to(roomId).emit("room-wait");
    }

    if (leaver.isOwner && room.players.size > 0) {
      const nextOwner = Array.from(room.players.values())[0];
      if (nextOwner) nextOwner.isOwner = true;
    }

    if (room.status === "WAIT" || room.status === "END") {
      const playerSnapshot = Array.from(room.players.values()).map((p) => ({
        socketId: p.socketId,
        nickname: p.nickname,
        isOwner: p.isOwner,
        isReady: p.isReady,
        score: p.score,
      }));
      io.to(roomId).emit("room-updated", {
        players: playerSnapshot,
        status: room.status,
      });
    } else if (room.status === "PLAY") {
      const winner = Array.from(room.players.values())[0];
      room.status = "END";

      if (room.gameDurationTimer) {
        clearTimeout(room.gameDurationTimer);
        room.gameDurationTimer = undefined;
      }

      const resultsEndAt = Date.now() + 15000;

      const finalScore = winner
        ? [
            {
              nickname: winner.nickname,
              score: winner.score,
              socketId: winner.socketId,
              isLeaver: false,
            },
            {
              nickname: leaver.nickname,
              score: leaver.score,
              socketId: leaver.socketId,
              isLeaver: true,
            },
          ]
        : [
            {
              nickname: leaver.nickname,
              score: leaver.score,
              socketId: leaver.socketId,
              isLeaver: true,
            },
          ];

      io.to(roomId).emit("game-end", {
        words: Array.from(room.usedWords),
        scores: finalScore,
        resultsEndAt,
      });

      return;
    }

    if (room.players.size === 0) {
      if (room.gameDurationTimer) {
        clearTimeout(room.gameDurationTimer);
        room.gameDurationTimer = undefined;
      }
      rooms.delete(roomId);
      await Chat.deleteMany({ roomId });
    }
  };

  socket.on("leave-room", () => handleLeaveRoom(socket));
  socket.on("disconnect", (reason) => {
    handleLeaveRoom(socket);
  });

  socket.on("join-room", async (data) => {
    const already = getRoomBySocket(socket.id);
    if (already) {
      const { roomId: oldId, room: oldRoom } = already;

      if (oldRoom.status === "PLAY") {
      } else {
        oldRoom.players.delete(socket.id);
        socket.leave(oldId);

        if (oldRoom.players.size === 0) {
          if (oldRoom.startTimer) clearTimeout(oldRoom.startTimer);
          if (oldRoom.readyNoticeTimer) clearTimeout(oldRoom.readyNoticeTimer);

          rooms.delete(oldId);
        }
      }
    }

    let entry = [...rooms.entries()].find(
      ([_, room]) => room.status === "WAIT" && room.players.size < 2,
    );

    let roomId: string;
    let room: Room;

    if (!data || !data.nickname) {
      return socket.emit("nickname-error", {
        message: "닉네임 정보가 없습니다.",
      });
    }
    const trimmedNickname = data.nickname.trim();

    if (!entry) {
      const created = createRoom();
      roomId = created.roomId;
      room = created.room;
    } else {
      [roomId, room] = entry;
    }

    const firstPlayer = room.players.size === 0;

    room.players.set(socket.id, {
      socketId: socket.id,
      nickname: trimmedNickname,
      roomId,
      isOwner: firstPlayer,
      isReady: false,
      score: 0,
    });

    socket.join(roomId);

    try {
      const history = await Chat.find({ roomId })
        .sort({ createdAt: 1 })
        .limit(50);
      const mappedHistory = history.map((chat) => ({
        socketId: chat.sender === "system" ? "system" : chat.sender,
        nickname: chat.sender,
        message: chat.message,
        type: chat.type,
      }));
      socket.emit("load-history", mappedHistory);

      io.to(roomId).emit("receive-chat", {
        socketId: "system",
        nickname: "",
        message: `${trimmedNickname}님이 입장하였습니다.`,
        type: "system",
      });
    } catch (err) {
      console.error("DB 로드 실패:", err);
      socket.emit("load-history", []);
    }

    const playerSnapshot: PlayerSnapshot[] = Array.from(
      room.players.values(),
    ).map((player) => ({
      socketId: player.socketId,
      nickname: player.nickname,
      isOwner: player.isOwner,
      isReady: player.isReady,
      score: player.score,
    }));

    io.to(roomId).emit("room-updated", {
      players: playerSnapshot,
      status: room.status,
    });

    socket.emit("set-my-id", { you: socket.id, yourScore: 0 });
    socket.emit("settings-updated", {
      timeLimit: room.timeLimit,
      usedTimeChangeCount: room.usedTimeChangeCount,
    });
  });

  socket.on("send-chat", async ({ message }) => {
    if (!message || message.trim() === "") return;

    const resultData = getRoomBySocket(socket.id);
    if (!resultData) return;

    const { room, roomId } = resultData;
    const player = room.players.get(socket.id);
    const realNickname = player ? player.nickname : "Unknown";

    try {
      const newChat = new Chat({
        roomId,
        sender: realNickname,
        message,
        type: "talk",
      });

      await newChat.save();

      io.to(roomId).emit("receive-chat", {
        socketId: socket.id,
        nickname: realNickname,
        message,
        type: "talk",
      });
    } catch (err) {
      console.error("채팅 저장 실패:", err);
    }
  });

  socket.on("change-setting", ({ timeLimit }) => {
    const resultData = getRoomBySocket(socket.id);
    if (!resultData) return;
    const { room, roomId } = resultData;

    const player = room.players.get(socket.id);
    if (!player || !player.isOwner) return;
    if (room.usedTimeChangeCount >= MAX_TIME_CHANGE_COUNT) return;

    room.timeLimit = timeLimit;
    room.usedTimeChangeCount += 1;

    io.to(roomId).emit("settings-updated", {
      timeLimit: room.timeLimit,
      usedTimeChangeCount: room.usedTimeChangeCount,
    });

    io.to(roomId).emit("receive-chat", {
      socketId: "system",
      nickname: "",
      message: `게임시간이 ${timeLimit}초로 변경되었습니다.`,
      type: "system",
    });
  });

  socket.on("toggle-ready", () => {
    const resultData = getRoomBySocket(socket.id);
    if (!resultData) return;

    const { roomId, room } = resultData;
    const player = room.players.get(socket.id);
    if (!player) return;

    player.isReady = !player.isReady;

    let systemMessaga = "";
    if (player.isOwner) {
      systemMessaga = player.isReady
        ? "방장이 시작 버튼을 눌렀습니다."
        : "방장이 취소 버튼을 눌렀습니다.";
    } else {
      systemMessaga = player.isReady
        ? `${player.nickname}님이 시작 버튼을 눌렀습니다.`
        : `${player.nickname}님이 취소 버튼을 눌렀습니다.`;
    }
    io.to(roomId).emit("receive-chat", {
      socketId: "system",
      nickname: "",
      message: systemMessaga,
      type: "system",
    });
    const players = Array.from(room.players.values());
    const allReady = players.every((p) => p.isReady);

    io.to(roomId).emit("room-updated", {
      players: players.map((p) => ({
        socketId: p.socketId,
        nickname: p.nickname,
        isOwner: p.isOwner,
        isReady: p.isReady,
        score: p.score,
      })),
    });

    if (allReady && players.length >= 2) {
      startCountdown(roomId, room, "ALL_READY");
    }
  });

  socket.on("force-start-game", () => {
    const resultData = getRoomBySocket(socket.id);
    if (!resultData) return;
    const { roomId, room } = resultData;
    const player = room.players.get(socket.id);

    if (player?.isOwner && room.status === "WAIT") {
      startCountdown(roomId, room, "FORCE");
    }
  });

  socket.on("cancel-force-start", () => {
    const resultData = getRoomBySocket(socket.id);
    if (!resultData) return;
    const { roomId, room } = resultData;
    const player = room.players.get(socket.id);

    if (player?.isOwner && room.status === "COUNTDOWN") {
      if (room.startTimer) {
        clearTimeout(room.startTimer);
        room.startTimer = undefined;
      }

      room.status = "WAIT";
      io.to(roomId).emit("room-wait");
      io.to(roomId).emit("receive-chat", {
        socketId: "system",
        nickname: "",
        message: "방장이 강제시작을 취소했습니다.",
        type: "system ",
      });
    }
  });

  socket.on("submit-word", async (data: { word: string }) => {
    const resultData = getRoomBySocket(socket.id);
    if (!resultData) return;

    const { room, roomId } = resultData;
    if (room.status !== "PLAY") return;

    const word = data.word.trim();
    if (room.endAt && Date.now() > room.endAt) return;

    const player = room.players.get(socket.id);

    const isAlreadyUsed = Array.from(room.usedWords).some(
      (used) => used.word === word,
    );

    if (isAlreadyUsed) {
      return socket.emit("word-validated", {
        word,
        valid: false,
        reason: "이미 사용된 단어입니다.",
        senderId: socket.id,
      });
    }

    const result = await validateWord({
      chosungPair: room.chosungPair,
      word: word,
      usedWords: new Set(Array.from(room.usedWords).map((uw) => uw.word)),
    });

    if (result.valid) {
      const secondCheckIdx = Array.from(room.usedWords).findIndex(
        (uw) => uw.word === word,
      );

      if (secondCheckIdx !== -1) {
        return socket.emit("word-validated", {
          word,
          valid: false,
          reason: "이런! 상대방이 조금 더 빨랐습니다!",
          senderId: socket.id,
        });
      }

      room.usedWords.add({
        word: word,
        senderId: socket.id,
        definitions: result.definitions ? [result.definitions as string] : [],
      });

      if (player) {
        player.score += 10;
      }

      io.to(roomId).emit("word-validated", {
        word: word,
        valid: true,
        reason: result.reason,
        senderId: socket.id,
        nickname: player?.nickname,
        processTime: result.processTime,
        players: Array.from(room.players.values()).map((p) => ({
          socketId: p.socketId,
          nickname: p.nickname,
          score: p.score,
        })),
      });
    } else {
      socket.emit("word-validated", {
        word,
        valid: false,
        reason: result.reason,
        processTime: result.processTime,
        senderId: socket.id,
      });
    }
  });
});

const startServer = async () => {
  try {
    await connectDB();
    console.log("DB 초기화 시작");
    await Chat.deleteMany({});
    console.log("DB 초기화 완료");

    const PORT = process.env.PORT || 3000;
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ DB 연결 실패로 서버를 시작하지 못했습니다:", err);
  }
};

startServer();
