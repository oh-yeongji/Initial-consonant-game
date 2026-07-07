import { useState, useEffect, useRef } from "react";
import { socket } from "@/socket/socket";
import GuideModal from "./rooms/GameRoom/components/GuideModal";
import NicknameModal from "./rooms/GameRoom/components/NicknameModal/NicknameModal";
import type { RoomStatus } from "./types/domain/room";
import "./index.css";
import WaitingRoom from "./rooms/GameRoom/components/WaitingRoom/WaitingRoom";
import CommonHeader from "./rooms/GameRoom/components/CommonHeader/CommonHeader";

const App = () => {
  const [connected, setConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [status, setStatus] = useState<RoomStatus>("WAIT");
  const [showfirstWindow, setShowFirstWindow] = useState<boolean>(true);
  const [entered, setEntered] = useState(false);
  const hasJoinedRef = useRef(false);
  const [skip, setSkip] = useState(() => {
    return localStorage.getItem("skipGuide") === "true";
  });
  const [activeModal, setActiveModal] = useState<"guide" | "nickname" | "none">(
    "none",
  );

  const handleGuideConfirm = (skipChecked: boolean) => {
    setSkip(skipChecked);
    if (skipChecked) {
      localStorage.setItem("skipGuide", "true");
    }
    setActiveModal("nickname");
  };

  const handleNicknameConfirm = (nickname: string) => {
    if (!nickname || nickname.trim() === "") return;

    socket.emit("join-room", { nickname: nickname.trim() });
    setActiveModal("none");
    setEntered(true);
  };

  useEffect(() => {
    const currentClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
      );
    };
    currentClock();
    const timer = setInterval(currentClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleEnterClick = () => {
    if (!socket.connected) {
      socket.connect();
    }

    if (skip) {
      setActiveModal("nickname");
    } else {
      setActiveModal("guide");
    }
    setShowFirstWindow(false);
  };

  const enterGameRoom = (skipChecked?: boolean) => {
    if (skipChecked) localStorage.setItem("skipGuide", "true");
    if (!entered) {
      setEntered(true);
    }
  };

  useEffect(() => {
    socket.connect();
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("room-wait", () => setStatus("WAIT"));

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("room-wait");
    };
  }, []);

  useEffect(() => {
    if (entered || activeModal !== "none") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      handleEnterClick();
    };

    window.addEventListener("keydown", handleKeyDown, { once: true });
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [entered, activeModal]);

  return (
    <div className="desktop-screen">
      {!entered && activeModal === "none" && (
        <>
          <div className="main-window">
            <CommonHeader
              title="설치 프로그램: 자음놀이 (v1.0.2)"
              isCloseDisabled={true}
            />

            <div className="window-content">
              <h2 className="title1">세기말</h2>
              <div className="app-identity">
                <h1 className="title2">자음 놀이</h1>
                <span className="versionName">v 1.0.2</span>
              </div>
              <div>
                {activeModal === "none" && (
                  <button className="enterRoom" onClick={handleEnterClick}>
                    PRESS ANY KEY
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="taskbar">
            <button className="systemStartBtn">시작</button>

            <div className="system-tray">{currentTime}</div>
          </div>
        </>
      )}

      {activeModal === "guide" && (
        <GuideModal
          initialSkip={skip}
          onToggle={setSkip}
          onConfirm={handleGuideConfirm}
          onClose={() => setActiveModal("none")}
        />
      )}

      {activeModal === "nickname" && (
        <NicknameModal
          onClose={() => setActiveModal("none")}
          onConfirm={handleNicknameConfirm}
        />
      )}

      {entered && (
        <WaitingRoom
          onClose={() => {
            setEntered(false);
            setActiveModal("none");
            setShowFirstWindow(true);
            socket.disconnect();
          }}
        />
      )}
    </div>
  );
};

export default App;
