import React, { useState, useEffect } from "react";
import CommonHeader from "./CommonHeader/CommonHeader";
import NicknameModal from "./NicknameModal/NicknameModal";

interface GuideModalProps {
  initialSkip: boolean;
  onConfirm: (skipChecked: boolean) => void;
  onClose: () => void;
  onToggle: (checked: boolean) => void;
}

const GuideModal = ({
  initialSkip,
  onConfirm,
  onClose,
  onToggle,
}: GuideModalProps) => {
  const [skip, setSkip] = useState(initialSkip);
  const [timeLeft, setTimeLeft] = useState(30);

  const handleToggle = (checked: boolean) => {
    setSkip(checked);
    onToggle(checked);
  };
  useEffect(() => {
    setSkip(initialSkip);
  }, [initialSkip]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        onConfirm(skip);
      } else if (e.key === "Escape") {
        onClose();
      } else if (e.code === "Space" || e.key.toLowerCase() === "s") {
        if (e.code === "Space") e.preventDefault();
        const nextSkip = !skip;
        setSkip(nextSkip);
        onToggle(nextSkip);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onConfirm, onClose, skip, onToggle]);

  useEffect(() => {
    if (timeLeft === 0) {
      onConfirm(skip);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onConfirm, skip]);

  return (
    <div style={styles.overlay}>
      <div style={styles[`main-window`]}>
        <CommonHeader
          title="[정보] 도움말 - Help.exe"
          onClose={onClose}
          style={{ margin: "0px" }}
        />

        <div style={styles.contentContainer}>
          <h2 style={styles.header}>※ 자음 놀이 이용 안내 ※</h2>

          <div style={styles.textBox}>
            {[
              <>명사 이외의 품사와 동음이의어는 불허합니다.</>,
              <>
                방 입장 후 재접속(새로고침) 시 강제 퇴장 처리되오니
                주의하십시오.
              </>,
              <>
                게임 진행 중 재접속(새로고침)은 비신사적인 행위로 간주하여
                <span style={{ color: "red" }}> 자동 기권패</span>로 처리됩니다.
              </>,
              <>
                기본 대결 시간은 60초이며, 방장(첫입장자)의 설정에 따라
                30/60/90/120초로 가변 가능합니다. 시간 변경 가능 횟수는 3회
                입니다.
              </>,
            ].map((content, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  gap: "8px",
                }}
              >
                <span style={{ flexShrink: 0 }}>■</span>

                <div
                  style={{
                    wordBreak: "keep-all",
                  }}
                >
                  {content}
                </div>
              </div>
            ))}
          </div>

          <div style={styles.statusLine}>
            {timeLeft}초 뒤 이 창이 자동으로 닫힙니다...
          </div>

          <div style={styles.footer}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={skip}
                onChange={(e) => handleToggle(e.target.checked)}
                style={{
                  ...styles.checkbox,
                  backgroundImage: skip
                    ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpath d='M2 5l2 2 4-4' stroke='black' stroke-width='2' fill='none'/%3E%3C/svg%3E")`
                    : "none",
                  backgroundSize: "12px",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "center",
                }}
              />
              ▶ 다시 보지 않기 (S)
            </label>
            <button style={styles.confirmBtn} onClick={() => onConfirm(skip)}>
              확인 (Enter)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    zIndex: 9999,
  },
  "main-window": {
    width: "650px",
    fontFamily: "'돋움', 'Dotum', 'AppleGothic', sans-serif",
    border: "3px solid",
    backgroundColor: "#c0c0c0",
    borderColor: "#ffffff #808080 #808080 #ffffff",
    padding: "2px",
    imageRendering: "pixelated",
    letterSpacing: "-0.5px",
  },

  contentContainer: {
    padding: "25px",
    backgroundColor: "#c0c0c0",
  },
  header: {
    textAlign: "center",
    color: "#000",
    fontSize: "22px",
    textDecoration: "underline",
    textUnderlineOffset: "5px",
    marginBottom: "20px",
  },
  textBox: {
    padding: "20px",
    lineHeight: "1.8",
    fontSize: "15px",
    color: "#000",
    marginBottom: "15px",
    backgroundColor: "#fff",
    border: "2px inset #808080",
  },
  statusLine: {
    fontSize: "12px",
    textAlign: "center",
    color: "#444",
    marginBottom: "20px",
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    cursor: "pointer",
  },
  checkbox: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "16px",
    height: "16px",
    position: "relative",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    border: "1px solid",
    marginBottom: "5px",
    borderColor: "#808080 #ffffff #ffffff #808080",
    boxShadow: "inset 1px 1px 0px #000 inset -1px -1px 0px #c0c0c0",
  },
  confirmBtn: {
    padding: "6px 25px",
    fontSize: "14px",
    fontWeight: "bold",
    backgroundColor: "#c0c0c0",
    border: "2px solid",
    borderColor: "#ffffff #505050 #505050 #ffffff",
    cursor: "pointer",
  },
};

export default GuideModal;
