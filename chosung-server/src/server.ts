import express from "express";
import { createServer } from "http";
import cors from "cors";
import { Server, Socket } from "socket.io";
import path from "path";
import { connectDB } from "./config/db";
import { Chat } from "./models/Chat";
import { randomUUID } from "crypto";
import gameRouter from "./routes/game.routes";
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

app.use("/api", gameRouter);

const httpServer = createServer(app);

connectDB();

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
  transports: ["polling", "websocket"],
});

/*==========================================app.use===================
        
         방 상태, 플레이어 설정

=======================================================*/

const rooms = new Map<string, Room>();

/*==========================================================================
        
      전체방 닉네임 중복 체크

============================================================================*/
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

/*==========================================================================
        
         방 생성

============================================================================*/
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

/*===================================================================
        
       이 소켓이 속해있는 방을 찾는 함수

====================================================================*/

const getRoomBySocket = (socketId: string) => {
  for (const [roomId, room] of rooms.entries()) {
    if (room.players.has(socketId)) {
      return { roomId, room };
    }
  }
  return null;
};

/*===================================================================
        
   게임시작하는 함수

====================================================================*/

const startGame = (roomId: string, room: Room) => {
  if (room.status === "PLAY") return;

  room.status = "PLAY";
  room.startTimer = undefined;
  room.chosungPair = getRandomChosungPair();
  room.usedWords = new Set();

  room.players.forEach((player) => {
    player.score = 0;
  });

  const limit = room.timeLimit || 60;
  const durationMs = limit * 1000;
  const bufferTime = 1500;
  const endAt = Date.now() + durationMs + bufferTime;

  room.endAt = endAt;
  io.to(roomId).emit("game-start", {
    chosungPair: room.chosungPair,
    endAt,
  });

  if (room.gameDurationTimer) clearTimeout(room.gameDurationTimer);

  room.gameDurationTimer = setTimeout(() => {
    if (room.status !== "PLAY") return;

    room.status = "END";

    room.gameDurationTimer = undefined;

    const finalScore = Array.from(room.players.values()).map((p) => ({
      nickname: p.nickname,
      score: p.score,
      socketId: p.socketId,
      isLeaver: false,
    }));

    io.to(roomId).emit("game-end", {
      words: Array.from(room.usedWords),
      scores: finalScore,
    });
  }, durationMs + bufferTime);
};

/*===================================================================
        
  대기방 시작 카운트 함수

====================================================================*/

const startCountdown = (
  roomId: string,
  room: any,
  trigger: "FORCE" | "ALL_READY",
) => {
  if (room.status === "COUNTDOWN") return;

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

/* =============================================================================
   


        Socket.IO 적용



================================================================================ */

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

    // 3. 결과 반환
    socket.emit("nickname-check-result", {
      available: !taken,
      nickname: trimmedNickname,
      message: taken
        ? "중복된 닉네임(별호) 입니다."
        : "사용 가능한 닉네임(별호) 입니다.",
    });
  });

  socket.on("join-room", async (data) => {
    const already = getRoomBySocket(socket.id);
    if (already) return;

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
      const history = await Chat.find({
        roomId,
      })
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
      console.error("DB저장 실패:", err);
      socket.emit("load-history", []);
    }

    const playerSnapshot: PlayerSnapshot[] = Array.from(
      room.players.values(),
    ).map((player) => {
      return {
        socketId: player.socketId,
        nickname: player.nickname,
        isOwner: player.isOwner,
        isReady: player.isReady,
        score: player.score,
      };
    });

    io.to(roomId).emit("room-updated", {
      players: playerSnapshot,
      status: room.status,
    });
    socket.emit("set-my-id", { you: socket.id, yourScore: 0 });
  });

  /*-------------------WaitingRoom 채팅-------------------------------*/
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

  /*---------WaitingRoom 시간 설정 변경---------------*/
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

  /*---------WaitingRoom 준비/시작 버튼---------------*/

  socket.on("toggle-ready", () => {
    const resultData = getRoomBySocket(socket.id);
    if (!resultData) return;

    const { roomId, room } = resultData;
    const player = room.players.get(socket.id);
    if (!player) return;

    player.isReady = !player.isReady;

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

  /*---------방장 강제 시작---------------*/

  socket.on("force-start-game", () => {
    const resultData = getRoomBySocket(socket.id);
    if (!resultData) return;
    const { roomId, room } = resultData;
    const player = room.players.get(socket.id);

    if (player?.isOwner && room.status === "WAIT") {
      startCountdown(roomId, room, "FORCE");
    }
  });

  /*---------방장 강제 시작 취소---------------*/

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
    }
  });
  /*---------초성 보내기---------------*/

  socket.on("submit-word", async (data: { word: string }) => {
    const word = data.word;
    const resultData = getRoomBySocket(socket.id);
    if (!resultData || resultData.room.status !== "PLAY") return;

    const { room, roomId } = resultData;
    if (room.endAt && Date.now() > room.endAt) return;
    const trimmed = word.trim();

    const isAlreadyUsed = Array.from(room.usedWords).some(
      (used) => used.word === trimmed,
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
      word: trimmed,
      usedWords: new Set(Array.from(room.usedWords).map((uw) => uw.word)),
    });

    if (result.valid) {
      room.usedWords.add({
        word: trimmed,
        senderId: socket.id,
        definitions: result.definitions || [],
      });

      const player = room.players.get(socket.id);
      if (player) {
        player.score += 10;
      }

      io.to(roomId).emit("word-validated", {
        word: trimmed,
        valid: true,
        reason: result.reason,
        senderId: socket.id,
        nickname: player?.nickname,

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
        senderId: socket.id,
      });
    }
  });

  /*=====================================================
        
       이탈, 연결끊김, 게임종료

=======================================================*/

  socket.on("disconnect", async (reason) => {
    console.log(`[EXIT] 유저 퇴장함: ${socket.id}, 사유: ${reason}`);

    const resultData = getRoomBySocket(socket.id);
    if (!resultData) return;

    const { roomId, room } = resultData;
    const leaverId = socket.id;
    const leaver = room.players.get(leaverId);

    if (!leaver) return;

    /*-------카툰트다운중 이탈 ->카툰트다운 취소 -----------*/

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

    if (room.status === "WAIT") {
      room.players.delete(leaverId);

      if (leaver.isOwner && room.players.size > 0) {
        const nextOwner = Array.from(room.players.values())[0];
        if (nextOwner) {
          nextOwner.isOwner = true;
          nextOwner.isReady = false;
        }
      }
      io.to(roomId).emit("receive-chat", {
        socketId: "system",
        nickname: "",
        message: `${leaver.nickname}님이 퇴장하였습니다.`,
        type: "system",
      });

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
      /*--------게임중 이탈 -----------*/
      if (room.gameDurationTimer) clearTimeout(room.gameDurationTimer);
      room.status = "END";

      const finalScore = Array.from(room.players.values()).map((p) => {
        const isLeaver = p.socketId === leaverId;
        return {
          nickname: isLeaver ? `${p.nickname} (기권)` : p.nickname,
          score: p.score,
          socketId: p.socketId,
          isLeaver: isLeaver,
        };
      });

      /*--------게임종료-----------*/

      io.to(roomId).emit("game-end", {
        words: Array.from(room.usedWords),
        scores: finalScore,
      });

      room.players.delete(leaverId);
    }

    if (room.players.size === 0) {
      rooms.delete(roomId);
      await Chat.deleteMany({ roomId });
      console.log(`[DELETE] 방 ${roomId} 종료 및 채팅 내역 삭제`);
    }
  });
});
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
