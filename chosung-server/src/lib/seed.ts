import fs from "fs";
import path from "path";
import csv from "csv-parser";
import { WordModel } from "../models/Word";

const CSV_FILE_NAME = "국립국어원_기본어휘.csv";
const csvFilePath = path.join(__dirname, "../data", CSV_FILE_NAME);

export const seedWordsFromCSV = () => {
  const results: any[] = [];

  if (!fs.existsSync(csvFilePath)) {
    console.error(`[에러] CSV 파일을 찾을 수 없습니다: ${csvFilePath}`);
    return;
  }

  console.log("-----------------------------------------");
  console.log("🚀 국립국어원 단어 데이터 임포트 시작...");

  fs.createReadStream(csvFilePath)
    .pipe(
      csv({
        mapHeaders: ({ header }) => {
          if (header === "수준") return "level";
          if (header === "동형어번호") return "num";
          if (header === "표출 어휘") return "word";
          return header;
        },
      }),
    )
    .on("data", (data) => {
      if (data.word) {
        // 1. 단어 정제: 숫자 제거 + "-" 특수문자 제거 + 공백 제거
        const cleanWord = data.word
          .split("/")[0]
          .replace(/[0-9]/g, "") // 숫자 제거
          .replace(/-/g, "") // "-" 기호 제거 (중복 에러 방지)
          .trim();

        // 2. 유효한 단어만 결과 배열에 추가
        if (cleanWord && cleanWord.length === 2) {
          // 2글자 이상만 추천
          results.push({
            word: cleanWord,
            level: data.level,
            exist: true,
            original: data.word,
            definition: "", // 모델에 definition이 필수라면 빈 값 추가
          });
        }
      }
    })
    .on("end", async () => {
      console.log(
        ` CSV 읽기 완료: 총 ${results.length}개 발견 (중복 제거 전)`,
      );

      try {
       const uniqueResults = Array.from(
          new Map(results.map((item) => [item.word, item])).values(),
        );

        console.log(`✨ 중복 제거 후 최종 단어 수: ${uniqueResults.length}개`);

        // 4. 기존 데이터 삭제 후 대량 삽입
        await WordModel.deleteMany({});

        // { ordered: false } 옵션을 주면 하나가 에러나도 나머지는 다 들어갑니다.
        await WordModel.insertMany(uniqueResults, { ordered: false });

        console.log("-----------------------------------------");
        console.log("✅ DB 저장 완료!");
        console.log("💡 샘플 데이터(5개):", uniqueResults.slice(0, 5));
        console.log("-----------------------------------------");
      } catch (err) {
        console.error("❌ DB 저장 중 오류 발생:", err);
      }
    });
};
