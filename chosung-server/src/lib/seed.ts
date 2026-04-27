import fs from "fs";
import path from "path";
import { WordModel } from "../models/Word";

const CSV_FILE_NAME = "국립국어원_기본어휘.csv";
const csvFilePath = path.join(process.cwd(), "src", "data", CSV_FILE_NAME);

export const seedWordsFromCSV = async () => {
  if (!fs.existsSync(csvFilePath)) {
    console.error(`[에러] 파일을 찾을 수 없음: ${csvFilePath}`);
    return;
  }

  console.log("🚀 라이브러리 없이 순수 JS로 데이터 임포트 시작...");

  const fileContent = fs.readFileSync(csvFilePath, "utf-8");
  const lines = fileContent.split("\n");
  const results: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const columns = line.split(",");
    const wordRaw = columns[2];
    const level = columns[0];

    if (wordRaw) {
      const cleanWord = wordRaw
        .split("/")[0]
        .replace(/[0-9]/g, "")
        .replace(/-/g, "")
        .trim();

      if (cleanWord.length === 2) {
        results.push({
          word: cleanWord,
          level: level,
          exist: true,
          original: wordRaw,
          definition: "",
        });
      }
    }
  }

  try {
    const uniqueResults = Array.from(
      new Map(results.map((item) => [item.word, item])).values(),
    );
    console.log(`✨ 최종 단어 수: ${uniqueResults.length}개`);
    await WordModel.insertMany(uniqueResults, { ordered: false });
    console.log("✅ DB 저장 완료!");
  } catch (err) {
    console.error("DB 저장 중 오류:", err);
  }
};
