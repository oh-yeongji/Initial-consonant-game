import mongoose from "mongoose";
import { performance } from "perf_hooks";
import { WordModel } from "../models/Word";

const API_KEY = process.env.KOREAN_DICT_API_KEY;

const TEST_WORDS = [
  "사과",
  "수박",
  "하늘",
  "바다",
  "구름",
  "기차",
  "안경",
  "책상",
  "의자",
  "연필",
  "시계",
  "지갑",
  "가방",
  "모자",
  "신발",
  "토끼",
  "사자",
  "우산",
  "축구",
  "나무",
  "가수",
  "버스",
  "가감",
  "바람",
  "바위",
  "태양",
  "호수",
  "파도",
  "소망",
  "평화",
  "연꽃",
  "장미",
  "나비",
  "기린",
  "여우",
  "늑대",
  "표범",
  "하마",
  "낙타",
  "사슴",
  "양파",
  "당근",
  "마늘",
  "피망",
  "버섯",
  "호박",
  "가지",
  "오이",
  "감자",
  "대파",
  "포도",
  "딸기",
  "참외",
  "석류",
  "레몬",
  "라임",
  "자두",
  "매실",
  "자몽",
  "묘수",
  "거울",
  "수건",
  "비누",
  "치약",
  "칫솔",
  "대문",
  "지붕",
  "액자",
  "화분",
  "열쇠",
  "필통",
  "공책",
  "볼펜",
  "사진",
  "그림",
  "노래",
  "악기",
  "피리",
  "소라",
  "조개",
  "전구",
  "전선",
  "침대",
  "이불",
  "베개",
  "양말",
  "바지",
  "치마",
  "코트",
  "고난",
  "반장",
  "회장",
  "교실",
  "강당",
  "정문",
  "후문",
  "운동",
  "야구",
  "농구",
  "배구",
];

const fetchFromApi = async (word: string) => {
  try {
    const url = `https://stdict.korean.go.kr/api/search.do?key=${API_KEY}&q=${encodeURIComponent(word.trim())}&req_type=json`;
    const response = await fetch(url);

    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    return null;
  }
};

const fetchFromDb = async (word: string) => {
  return await WordModel.findOne({ word: word.trim() }).lean();
};

export const runComparison = async () => {
  try {
    console.log(
      "🔌 DB 연결 완료. 2글자 단어 100개 기준 벤치마크를 시작합니다...\n",
    );

    const apiTimes: number[] = [];
    const dbTimes: number[] = [];

    for (let i = 0; i < TEST_WORDS.length; i++) {
      const word = TEST_WORDS[i];

      const apiStart = performance.now();
      await fetchFromApi(word);
      const apiEnd = performance.now();
      apiTimes.push(apiEnd - apiStart);

      const dbStart = performance.now();
      await fetchFromDb(word);
      const dbEnd = performance.now();
      dbTimes.push(dbEnd - dbStart);

      if ((i + 1) % 10 === 0) {
        console.log(`⏳ 진행 중... [${i + 1}/${TEST_WORDS.length}] 완료`);
      }
    }

    const calcStats = (times: number[]) => {
      const sorted = [...times].sort((a, b) => a - b);
      const avg = times.reduce((acc, cur) => acc + cur, 0) / times.length;
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      const mid = Math.floor(sorted.length / 2);
      const median =
        sorted.length % 2 !== 0
          ? sorted[mid]
          : (sorted[mid - 1] + sorted[mid]) / 2;

      return { min, max, avg, median };
    };

    const apiStats = calcStats(apiTimes);
    const dbStats = calcStats(dbTimes);

    const speedupTimes = apiStats.avg / dbStats.avg;
    const timeSavedPercent =
      ((apiStats.avg - dbStats.avg) / apiStats.avg) * 100;

    const resultData = {
      testCount: TEST_WORDS.length,
      apiStats: {
        min: `${apiStats.min.toFixed(2)}ms`,
        max: `${apiStats.max.toFixed(2)}ms`,
        avg: `${apiStats.avg.toFixed(2)}ms`,
        median: `${apiStats.median.toFixed(2)}ms`,
      },
      dbStats: {
        min: `${dbStats.min.toFixed(2)}ms`,
        max: `${dbStats.max.toFixed(2)}ms`,
        avg: `${dbStats.avg.toFixed(2)}ms`,
        median: `${dbStats.median.toFixed(2)}ms`,
      },
      summary: {
        speedup: `DB가 약 ${speedupTimes.toFixed(1)}배 빠름`,
        timeSaved: `응답 시간 약 ${timeSavedPercent.toFixed(1)}% 단축`,
      },
    };

    return resultData;
  } catch (err) {
    console.error("❌ 벤치마크 중 오류 발생:", err);
    return { error: "벤치마크 실행 중 오류가 발생했습니다." };
  }
};
