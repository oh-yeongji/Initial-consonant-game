import { Router } from "express";
import { checkWordDetail } from "../lib/dict";

const gameRouter = Router();

//나중에 roomId로 변경예정
const usedWords = new Set<string>();

gameRouter.get("/check-word", async (req, res) => {
  const { word } = req.query;

  if (typeof word !== "string") {
    return res.status(400).json({ valid: false });
  }

  const trimmed = word.trim();

  // 1. 두글자 검사
  if (!/^[가-힣]{2}$/.test(trimmed)) {
    return res.json({ valid: false });
  }

  // 2. 중복검사
  // if (usedWords.has(trimmed)) {
  //   return res.json({ valid: false });
  // }

  // 3. 단어의 존재여부
  const dictResult = await checkWordDetail(trimmed);
  if (!dictResult.exist) {
    return res.json({ valid: false, reason: "존재하지않는 단어입니다." });
  }

  // 통과 시
  usedWords.add(trimmed);
  res.json({ valid: true });
});

export default gameRouter;
