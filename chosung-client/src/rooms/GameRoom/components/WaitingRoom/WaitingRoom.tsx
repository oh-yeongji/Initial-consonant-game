import { useEffect, useState, useRef, useCallback } from "react";
import { socket } from "@/socket/socket";
import styles from "./WaitingRoom.module.css";
import CommonHeader from "../CommonHeader/CommonHeader";
import GameRoom from "../../GameRoom";
import type { RoomStatus, PlayerSnapshot } from "@/types/domain/room";

interface WaitingRoomProps {
  onClose: () => void;
}

const WaitingRoom = ({ onClose }: WaitingRoomProps) => {
  const [showReadyPopup, setShowReadyPopup] = useState(false);
  const [users, setUsers] = useState<PlayerSnapshot[]>([]);
  const [myId, setMyId] = useState<string>("");
  const [showForceStart, setShowForceStart] = useState<boolean>(false);
  const [state, setState] = useState<RoomStatus>("WAIT");
  const [chatList, setChatList] = useState<any[]>([]);
  const [startCountdown, setStartCountdown] = useState<number | null>(null);
  const [usedTimeChangeCount, setUsedTimeChangeCount] = useState<number>(0);
  const [timeIdx, setTimeIdx] = useState(1);
  const [appliedTime, setAppliedTime] = useState<number>(60);
  const [startTrigger, setStartTrigger] = useState("");
  const [isGameStarted, setIsGameStarted] = useState<boolean>(false);
  const [gameInitData, setGameInitData] = useState<any>(null);
  const [gameVersion, setGameVersion] = useState(0);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const times = [30, 60, 90, 120];

  const me = users?.find((u) => u.socketId === myId);
  const isOwner = me?.isOwner || false;
  const myReadyStatus = me?.isReady || false;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatList]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (
          startCountdown !== null &&
          isOwner &&
          startTrigger !== "ALL_READY"
        ) {
          socket.emit("cancel-force-start");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [startCountdown, isOwner, startTrigger]);

  const handleRestart = useCallback(() => {
    setIsGameStarted(false);
    setGameInitData(null);
    setGameVersion((v) => v + 1);
    setState("WAIT");
    setStartCountdown(null);
    setShowReadyPopup(false);
  }, []);

  const handleSendMessage = (e?: React.KeyboardEvent<HTMLInputElement>) => {
    if (e?.nativeEvent.isComposing) return;
    const message = chatInputRef.current?.value;
    if (!me || !message?.trim()) return;

    socket.emit("send-chat", {
      socketId: myId,
      nickname: me.nickname,
      message,
    });
    if (chatInputRef.current) chatInputRef.current.value = "";
  };

  useEffect(() => {
    if (!socket.connected) socket.connect();

    socket.on("set-my-id", ({ you }) => setMyId(you));
    socket.on("settings-updated", ({ timeLimit, usedTimeChangeCount }) => {
      setAppliedTime(timeLimit);
      setUsedTimeChangeCount(usedTimeChangeCount);
      const idx = times.findIndex((t) => t === timeLimit);
      if (idx !== -1) setTimeIdx(idx);
    });
    socket.on("receive-chat", (chatData) =>
      setChatList((prev) => [...prev, chatData]),
    );
    socket.on("load-history", (history) => setChatList(history));
    socket.on("room-updated", ({ players, status }) => {
      setUsers(players);
      if (status) setState(status);
    });
    socket.on("all-ready-notice", ({ trigger }) => {
      setStartTrigger(trigger);
      setShowReadyPopup(true);
    });
    socket.on("countdown-start", ({ seconds }) => {
      setShowReadyPopup(false);
      setState("COUNTDOWN");
      setStartCountdown(seconds);
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        setStartCountdown((prev) =>
          prev === null || prev <= 1
            ? (clearInterval(intervalRef.current!), null)
            : prev - 1,
        );
      }, 1000);
    });
    socket.on("room-wait", () => {
      setState("WAIT");
      setShowReadyPopup(false);
      setStartCountdown(null);
      setStartTrigger("");
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    });
    socket.on("game-start", (game) => {
      setGameInitData({ ...game, players: users, myId: myId });
      setIsGameStarted(true);
    });

    return () => {
      socket.off("set-my-id");
      socket.off("settings-updated");
      socket.off("receive-chat");
      socket.off("load-history");
      socket.off("room-updated");
      socket.off("all-ready-notice");
      socket.off("countdown-start");
      socket.off("room-wait");
      socket.off("game-start");
    };
  }, [users, myId]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const isAllReady = users.length > 0 && users.every((u) => u.isReady);

    if (isOwner && users.length >= 2 && myReadyStatus && !isAllReady) {
      timer = setTimeout(() => {
        setShowForceStart(true);
      }, 10000);
    } else {
      setShowForceStart(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isOwner, users, myReadyStatus]);

  if (isGameStarted && gameInitData) {
    return (
      <GameRoom
        key={`game-session-${gameVersion}`}
        timeLimit={times[timeIdx]}
        initialData={gameInitData}
        onRestart={handleRestart}
      />
    );
  }

  return (
    <div className={styles["out-of-stage"]}>
      {showReadyPopup && (
        <div className={styles.readyOverlay}>
          <div className={styles.readyWrapper}>
            <CommonHeader
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: "none",
                margin: 0,
              }}
              title="준비..."
            />
            <div className={styles.readyTextContainer}>
              <p className={styles.readyText}>
                {startTrigger === "ALL_READY"
                  ? "모든 사용자가 준비되었습니다.\n3초 타이머 후 게임이 시작됩니다."
                  : "방장의 권한으로\n3초 타이머 후 게임이 시작됩니다."}
              </p>
            </div>
          </div>
        </div>
      )}

      {startCountdown !== null && (
        <div className={styles.countdownOverlay}>
          <div className={styles.countdownWrapper}>
            <CommonHeader
              style={{ position: "relative", width: "100%" }}
              title="데이터 동기화중..."
            />
            <div className={styles.windowContent}>
              <p className={styles.infoText}>게임 시작까지...</p>
              <div className={styles.countdownNumberContainer}>
                <div className={styles.countdownNumber}>{startCountdown}</div>
              </div>
              <div className={styles.btnGroup}>
                <button
                  disabled={!isOwner || startTrigger === "ALL_READY"}
                  className={`${styles.closeBtn} ${!isOwner || startTrigger === "ALL_READY" ? styles.disabled : ""}`}
                  onClick={() => isOwner && socket.emit("cancel-force-start")}
                >
                  취소 (Esc)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={styles.wrapper}>
        <CommonHeader
          style={{ position: "absolute" }}
          title="자음놀이 (대기방)"
          onClose={onClose}
        />
        <div className={styles.stage}>
          <div className={styles.LobbySidePanel}>
            <div className={styles.settingWrapper}>
              <div className={styles.panelTitleContainer}>
                <p className={styles.panelTitle}>시간 설정</p>
                {isOwner && (
                  <p className={styles.panelTitle}>
                    시간 변경 가능 횟수: {3 - usedTimeChangeCount}회
                  </p>
                )}
              </div>
              <div className={styles.settingContainer}>
                <div className={styles.first}>
                  <button
                    disabled={!isOwner || usedTimeChangeCount >= 3}
                    className={styles.leftBtn}
                    onClick={() => setTimeIdx((p) => (p === 0 ? 3 : p - 1))}
                  >
                    ◀
                  </button>
                  <div
                    className={`${styles.timeSetting} ${times[timeIdx] === appliedTime ? styles.selectedTime : ""}`}
                  >
                    {times[timeIdx]}초
                  </div>
                  <button
                    disabled={!isOwner || usedTimeChangeCount >= 3}
                    className={styles.rightBtn}
                    onClick={() => setTimeIdx((p) => (p === 3 ? 0 : p + 1))}
                  >
                    ▶
                  </button>
                </div>
                <button
                  disabled={
                    !isOwner ||
                    times[timeIdx] === appliedTime ||
                    usedTimeChangeCount >= 3
                  }
                  className={styles.changeBtn}
                  onClick={() =>
                    socket.emit("change-setting", { timeLimit: times[timeIdx] })
                  }
                >
                  {isOwner ? "변경" : "🔒 방장전용"}
                </button>
              </div>
            </div>

            <div className={styles.userListWrapper}>
              <p className={styles.panelTitle}>입장 유저목록</p>
              <div className={styles.userList}>
                {users.map((user) => (
                  <div key={user.socketId} className={styles.userContainer}>
                    <div
                      className={styles.nickname}
                      style={{
                        color: user.socketId === myId ? "#2f6df6" : "#000",
                      }}
                    >
                      {user.isOwner ? "[방장]" : ""} {user.nickname}{" "}
                      {user.socketId == myId ? " (당신)" : ""}
                    </div>
                    {user.isReady && (
                      <div className={styles.readyMark}>Ready</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button
              disabled={!isOwner || !showForceStart}
              className={styles.forceStart}
              onClick={() => socket.emit("force-start-game")}
            >
              강제 시작
            </button>
            <div
              className={`${styles.playerStatusBtn} ${myReadyStatus ? styles.active : ""} ${users.length < 2 ? styles.disabled : ""}`}
              onClick={() => users.length >= 2 && socket.emit("toggle-ready")}
            >
              {isOwner
                ? myReadyStatus
                  ? "GAME START"
                  : "READY?"
                : myReadyStatus
                  ? "READY!"
                  : "READY?"}
            </div>
          </div>

          <div
            className={styles.chatScreen}
            ref={scrollRef}
            style={{ overflowY: "auto" }}
          >
            {chatList.map((chat, idx) => {
              const isSystem =
                chat.socketId === "system" || chat.type === "system";
              return (
                <div key={idx} className={styles.chatContainer}>
                  <div className={isSystem ? styles.systemMsg : styles.userMsg}>
                    {isSystem ? (
                      <span
                        className={styles.userChat}
                      >{`>>> [시스템] ${chat.message}`}</span>
                    ) : (
                      <>
                        <span className={styles.nickname}>
                          {chat.nickname || "알수없음"}
                        </span>
                        :{" "}
                        <span className={styles.userChat}>{chat.message}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            <div className={styles.inputContainer}>
              <input
                className={styles.msgChat}
                type="text"
                ref={chatInputRef}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage(e)}
              />
              <button
                className={styles.msgSendBtn}
                onClick={() => handleSendMessage()}
              >
                Enter
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaitingRoom;
