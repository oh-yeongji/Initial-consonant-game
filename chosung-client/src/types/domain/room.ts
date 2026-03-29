export type RoomStatus = "WAIT" | "COUNTDOWN" | "PLAY" | "END";

export interface PlayerSnapshot {
  socketId: string;
  nickname: string;
  isOwner: boolean;
  isReady: boolean;
}

export interface GameEndData {
  words: { word: string; definitions: string[]; senderId: string }[];
  scores: {
    socketId: string;
    nickname: string;
    score: number;
    isLeaver?: boolean;
  }[];
}
