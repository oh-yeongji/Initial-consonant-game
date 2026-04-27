import { extractTwoChosungs } from "./chosung";
import { Room } from "../types";
import { checkWordDetail } from "../lib/dict";

interface ValidateParams {
  chosungPair: [string, string];
  word: string;
  usedWords: Set<string>;
  skipChosungCheck?: boolean;
}

export interface ValidateResult {
  valid: boolean;
  reason?: string;
  word?: string;
  definitions?: string | string[];
  processTime?: string;
}
export async function validateWord({
  chosungPair,
  word,
  usedWords,
  skipChosungCheck = false,
}: ValidateParams): Promise<ValidateResult> {
  const trimmed = word.trim();

  if (!trimmed || trimmed === "") {
    return {
      valid: false,
      reason: "단어를 입력하세요.",
    };
  }

  if (trimmed.length !== 2) {
    return {
      valid: false,
      reason: "두 단어만 입력하세요.",
    };
  }

  if (!/^[가-힣]+$/.test(trimmed)) {
    return { valid: false, reason: "한글만 입력 가능합니다." };
  }

  if (usedWords.has(trimmed)) {
    return {
      valid: false,
      reason: "이미 사용한 단어입니다.",
    };
  }

  const extracted = extractTwoChosungs(trimmed);

  if (!extracted) {
    return { valid: false, reason: "단어를 입력하세요" };
  }

  if (extracted[0] !== chosungPair[0] || extracted[1] !== chosungPair[1]) {
    return { valid: false, reason: "입력한 단어와 초성이 일치하지않습니다." };
  }

  const dictResult = await checkWordDetail(trimmed);

  const { exist, definition } = dictResult;

  if (!exist) {
    return {
      valid: false,
      reason: "사전에 없는 단어입니다.",
      definitions: [],
      processTime: dictResult.processTime,
    };
  }

  return {
    valid: true,
    word: trimmed,
    definitions: definition,
    processTime: dictResult.processTime,
  };
}
