import { useState, useEffect, useCallback, useMemo } from "react";
import { socket } from "@/socket/socket";
import styles from "./GameRoom.module.css";
import PlayerPanel from "./components/PlayerPanel/PlayerPanel";
import CenterPlay from "./components/CenterPlay/CenterPlay";
import ResultModal from "./components/ResultModal";
import CommonHeader from "./components/CommonHeader/CommonHeader";

import type {
  RoomStatus,
  PlayerSnapshot,
  GameEndData,
} from "@/types/domain/room";
import { log } from "console";

interface GameRoomProps {
  timeLimit: number;
  initialData: any;
}

const GameRoom = ({ timeLimit, initialData }: GameRoomProps) => {
  const [roomData, setRoomData] = useState<{
    players: PlayerSnapshot[];
    myId: string;
    myScore: number;
  }>({
    players: initialData?.players || [],
    myId: initialData?.myId || socket.id || "",
    myScore: 0,
  });

  const [state, setState] = useState<RoomStatus>("PLAY");
  const [showStartOverlay, setShowStartOverlay] = useState<boolean>(true);
  const [chosungPair, setChosungPair] = useState<[string, string]>(
    initialData?.chosungPair || ["?", "?"],
  );
  const [lastResult, setLastResult] = useState<any>(null);

  const [myWords, setMyWords] = useState<string[]>([]);
  const [opponentWords, setOpponentWords] = useState<string[]>([]);

  const [timeLeftMs, setTimeLeftMs] = useState<number>(timeLimit * 1000);
  const [endAt, setEndAt] = useState<number | null>(initialData?.endAt || null);
  const [showEndOverlay, setShowEndOverlay] = useState<boolean>(false);
  const [finalData, setFinalData] = useState<GameEndData | null>(null);

  const me = useMemo(
    () =>
      roomData.players.find((p) => p.socketId === (roomData.myId || socket.id)),
    [roomData.players, roomData.myId],
  );

  const opponent = useMemo(
    () =>
      roomData.players.find(
        (p) => p.socketId !== roomData.myId && roomData.myId !== "",
      ),
    [roomData.players, roomData.myId],
  );

  const resetGameStatus = useCallback(() => {
    setState("WAIT");
    setFinalData(null);
    setMyWords([]);
    setOpponentWords([]);
  }, []);

  const onWordValidated = useCallback((res: any) => {
    console.log("=== 단어 검증 응답 도착 ===");
    console.log("서버가 보낸 단어:", res.word);
    console.log("유효 여부(valid):", res.valid);
    console.log("실패 사유(reason):", res.reason);
    console.log("서버가 보낸 senderId:", res.senderId);
    console.log("현재 내 socket.id:", socket.id);
    console.log("현재 내 roomData.myId:", roomData.myId);

    setLastResult(res);
    if (!res.valid) return;

    // handleWordResult(res.word, res.senderId);
    const currentSocketId = socket.id;
    if (res.senderId === currentSocketId) {
      console.log("결과: [내 단어장]에 추가함");
      setMyWords((prev) => [...prev, res.word]);
    } else {
      console.log("결과: [상대 단어장]에 추가함");
      setOpponentWords((prev) => [...prev, res.word]);
    }
  }, []);

  // 게임시작 문구 나올때
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowStartOverlay(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // 타이머 끝.
  useEffect(() => {
    if (!endAt || state !== "PLAY") return;

    const tick = setInterval(() => {
      const actualRemaining = Math.max(0, endAt - Date.now());

      const displayTime = Math.min(timeLimit * 1000, actualRemaining);

      if (showStartOverlay) {
        setTimeLeftMs(timeLimit * 1000);
      } else {
        setTimeLeftMs(displayTime);
      }

      if (Date.now() >= endAt) {
        clearInterval(tick);
        setTimeLeftMs(0);
      }
    }, 100);

    return () => clearInterval(tick);
  }, [endAt, state, showStartOverlay, timeLimit]);

  // 게임 방 입장 할때
  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }
    socket.emit("join-room");

    const onRoomUpdated = ({ players }: { players: PlayerSnapshot[] }) => {
      setRoomData((prev) => ({ ...prev, players }));
    };

    const onSetMyId = ({ you }: { you: string }) => {
      setRoomData((prev) => ({ ...prev, myId: you }));
    };

    const onGameStart = ({ chosungPair, endAt }: any) => {
      setState("PLAY");
      setChosungPair(chosungPair);
      console.log("chosung:", chosungPair);
      setEndAt(endAt);
      setMyWords([]);
      setOpponentWords([]);
    };

    const onGameEnd = (data: GameEndData) => {
      if (!data || !data.scores) return;

      const myData = data.scores.find((p) => p.socketId === roomData.myId);
      const opData = data.scores.find((p) => p.socketId !== roomData.myId);

      if (myData) myData.score;
      if (opData) opData.score;

      setFinalData(data);
      setTimeLeftMs(0);

      setShowEndOverlay(true);

      setTimeout(() => {
        setShowEndOverlay(false);
        setState("END");
      }, 1000);
    };

    socket.on("word-validated", onWordValidated);
    socket.on("room-updated", onRoomUpdated);
    socket.on("set-my-id", onSetMyId);
    socket.on("game-start", onGameStart);
    socket.on("game-end", onGameEnd);

    return () => {
      socket.off("room-updated", onRoomUpdated);
      socket.off("set-my-id", onSetMyId);
      socket.off("game-start", onGameStart);
      socket.off("word-validated", onWordValidated);
      socket.off("game-end", onGameEnd);
    };
  }, [onWordValidated]);

  return (
    <>
      <div className={styles["out-of-stage"]} />

      {showStartOverlay && (
        <div className={styles.gameStartOverlay}>
          <div className={styles.gameStartContent}>
            <h1 className={styles.gamestartText}>GAME START!</h1>
          </div>
        </div>
      )}

      {showEndOverlay && (
        <div className={styles.gameEndOverlay}>
          <div className={styles.gameEndContent}>
            <h1 className={styles.gameEndText}>GAME END!</h1>
          </div>
        </div>
      )}

      {state === "END" && !showEndOverlay && finalData && (
        <ResultModal
          socket={socket}
          scores={finalData.scores || []}
          words={finalData.words || []}
          onReset={resetGameStatus}
        />
      )}

      <div className={styles.stage}>
        <CommonHeader
          style={{
            position: "absolute",
          }}
          title="자음 놀이 (놀이마당)"
        />
        <PlayerPanel
          key="left-me"
          nickname={me?.nickname ?? "대기중"}
          words={myWords}
        />
        <CenterPlay
          chosungPair={showStartOverlay ? ["?", "?"] : chosungPair}
          lastResult={lastResult}
          onSubmitWord={(word) => socket.emit("submit-word", { word })}
          timeLeftMs={
            showStartOverlay
              ? timeLimit * 1000
              : Math.min(timeLimit * 1000, timeLeftMs)
          }
          state={state}
        />
        <PlayerPanel
          key="right-opponent"
          nickname={
            opponent && opponent.socketId !== roomData.myId
              ? opponent.nickname
              : roomData.players.length < 2
                ? "상대를 기다리는중..."
                : "로딩 중"
          }
          words={opponentWords}
        />
      </div>
    </>
  );
};

export default GameRoom;
