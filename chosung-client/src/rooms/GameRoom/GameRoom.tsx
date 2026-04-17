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

interface InitialData {
  players: PlayerSnapshot[];
  myId?: string;
  chosungPair: [string, string];
  endAt: number | null;
}

interface GameRoomProps {
  timeLimit: number;
  initialData: InitialData;
  onClose: () => void;
  onRestart: () => void;
}

const GameRoom = ({
  timeLimit,
  initialData,
  onClose,
  onRestart,
}: GameRoomProps) => {
  const myId = useMemo(
    () => initialData?.myId || socket.id || "",
    [initialData?.myId],
  );
  const [players, setPlayers] = useState<PlayerSnapshot[]>(
    initialData?.players || [],
  );
  const [state, setState] = useState<RoomStatus>("PLAY");
  const [showStartOverlay, setShowStartOverlay] = useState<boolean>(true);
  const [lastResult, setLastResult] = useState<any>(null);
  const [myWords, setMyWords] = useState<string[]>([]);
  const [opponentWords, setOpponentWords] = useState<string[]>([]);
  const [timeLeftMs, setTimeLeftMs] = useState<number>(timeLimit * 1000);
  const [showEndOverlay, setShowEndOverlay] = useState<boolean>(false);
  const [finalData, setFinalData] = useState<GameEndData | null>(null);

  const chosungPair = initialData?.chosungPair || ["?", "?"];
  const endAt = initialData?.endAt || null;
  const [resultsEndAt, setResultsEndAt] = useState<number>(0);
  const me = useMemo(
    () => players.find((p) => p.socketId === myId),
    [players, myId],
  );
  const opponent = useMemo(
    () => players.find((p) => p.socketId !== myId),
    [players, myId],
  );

  const onWordValidated = useCallback((res: any) => {
    console.log("서버에서 보냄:", res);

    setLastResult(res);
    if (!res.valid) return;
    if (res.senderId === socket.id) {
      setMyWords((prev) => [...prev, res.word]);
    } else {
      setOpponentWords((prev) => [...prev, res.word]);
    }
  }, []);

  useEffect(() => {
    const overlayTimer = setTimeout(() => setShowStartOverlay(false), 1500);
    return () => clearTimeout(overlayTimer);
  }, []);

  useEffect(() => {
    if (!endAt || state !== "PLAY") return;

    const tick = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, endAt - now);
      setTimeLeftMs(remaining);

      if (remaining <= 0) {
        clearInterval(tick);
      }
    }, 100);

    return () => clearInterval(tick);
  }, [endAt, state]);

  useEffect(() => {
    const onGameEnd = (data: GameEndData & { resultsEndAt: number }) => {
      setFinalData(data);
      setResultsEndAt(data.resultsEndAt);
      setShowEndOverlay(true);
      setTimeout(() => {
        setShowEndOverlay(false);
        setState("END");
      }, 1500);
    };

    const onRoomUpdated = (data: { players: PlayerSnapshot[] }) => {
      setPlayers(data.players);
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
          onClose={onClose}
          onReset={onRestart}
          resultsEndAt={resultsEndAt}
        />
      )}

      <div className={styles.stage}>
        <CommonHeader
          style={{ position: "absolute" }}
          title="자음 놀이 (놀이마당)"
          onClose={onClose}
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
