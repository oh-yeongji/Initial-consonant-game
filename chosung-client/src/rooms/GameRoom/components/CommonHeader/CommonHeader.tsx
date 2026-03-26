import styles from "./CommonHeader.module.css";

interface CommonHeaderProps {
  title: React.ReactNode;
  style?: React.CSSProperties;
  onClose?: () => void;
  isCloseDisabled?: boolean;
}
const CommonHeader = ({
  title,
  style,
  onClose,
  isCloseDisabled,
}: CommonHeaderProps) => {
  return (
    <div className={styles.header} style={style}>
      <span className={styles.titleName}>{title}</span>
      <button
        className={styles.closeBtn}
        onClick={onClose}
        disabled={isCloseDisabled}
      >
        X
      </button>
    </div>
  );
};
export default CommonHeader;
