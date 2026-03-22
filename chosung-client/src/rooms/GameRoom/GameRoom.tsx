import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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

interface GameRoomProps {
  timeLimit: number;
  initialData: any;
  onRestart: () => void;
}

const GameRoom = ({ timeLimit, initialData, onRestart }: GameRoomProps) => {
  const [roomData, setRoomData] = useState<{
    players: PlayerSnapshot[];
    myId: string;
  }>({
    players: initialData?.players || [],
    myId: initialData?.myId || socket.id || "",
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
    () => roomData.players.find((p) => p.socketId === roomData.myId),
    [roomData.players, roomData.myId],
  );

  const opponent = useMemo(
    () => roomData.players.find((p) => p.socketId !== roomData.myId),
    [roomData.players, roomData.myId],
  );

  const onWordValidated = useCallback((res: any) => {
    setLastResult(res);
    if (!res.valid) return;
    if (res.senderId === socket.id) {
      setMyWords((prev) => [...prev, res.word]);
    } else {
      setOpponentWords((prev) => [...prev, res.word]);
    }
  }, []);

  useEffect(() => {
    if (!endAt || state !== "PLAY") return;

    const overlayTimer = setTimeout(() => setShowStartOverlay(false), 1500);

    const tick = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, endAt - now);
      setTimeLeftMs(remaining);

      if (remaining <= 0) {
        clearInterval(tick);
      }
    }, 100);

    return () => {
      clearInterval(tick);
      clearTimeout(overlayTimer);
    };
  }, [endAt, state]);

  useEffect(() => {
    const onGameEnd = (data: GameEndData) => {
      setFinalData(data);
      setShowEndOverlay(true);
      setTimeout(() => {
        setShowEndOverlay(false);
        setState("END");
      }, 1500);
    };

    const onRoomUpdated = ({ players }: { players: PlayerSnapshot[] }) => {
      setRoomData((prev) => ({ ...prev, players }));
    };

    socket.on("word-validated", onWordValidated);
    socket.on("game-end", onGameEnd);
    socket.on("room-updated", onRoomUpdated);

    return () => {
      socket.off("word-validated", onWordValidated);
      socket.off("game-end", onGameEnd);
      socket.off("room-updated", onRoomUpdated);
    };
  }, [onWordValidated]);

  return (
    <div className={styles.gameContainer}>
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

      {state === "END" && finalData && (
        <ResultModal
          socket={socket}
          scores={finalData.scores}
          words={finalData.words || []}
          onReset={onRestart}
        />
      )}

      <div className={styles.stage}>
        <CommonHeader
          style={{ position: "absolute" }}
          title="자음 놀이 (놀이마당)"
        />

        <PlayerPanel
          key="left-me"
          nickname={me?.nickname ?? "나"}
          words={myWords}
        />

        <CenterPlay
          chosungPair={chosungPair}
          lastResult={lastResult}
          onSubmitWord={(word) => socket.emit("submit-word", { word })}
          timeLeftMs={timeLeftMs}
          state={state}
        />

        <PlayerPanel
          key="right-opponent"
          nickname={opponent?.nickname ?? "상대"}
          words={opponentWords}
        />
      </div>
    </div>
  );
};

export default GameRoom;
