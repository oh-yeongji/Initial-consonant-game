import fs from "fs";
import path from "path";
import { WordModel } from "../models/Word";

const CSV_FILE_NAME = "국립국어원_기본어휘.csv";
const csvFilePath = path.join(process.cwd(), "src", "data", CSV_FILE_NAME);

export const seedWordsFromCSV = async () => {
  const csvParserModule: any = await import("csv-parser" as string);
  const csvParser = csvParserModule.default || csvParserModule;

  const results: any[] = [];

  if (!fs.existsSync(csvFilePath)) {
    console.error(`[에러] 파일을 찾을 수 없음: ${csvFilePath}`);
    return;
  }

  console.log("🚀 데이터 임포트 시작...");

  fs.createReadStream(csvFilePath)
    .pipe(
      csvParser({
        mapHeaders: ({ header }: { header: string }) => {
          if (header === "수준") return "level";
          if (header === "동형어번호") return "num";
          if (header === "표출 어휘") return "word";
          return header;
        },
      }),
    )
    .on("data", (data: any) => {
      if (data.word) {
        const cleanWord = data.word
          .split("/")[0]
          .replace(/[0-9]/g, "")
          .replace(/-/g, "")
          .trim();

        if (cleanWord && cleanWord.length === 2) {
          results.push({
            word: cleanWord,
            level: data.level,
            exist: true,
            original: data.word,
            definition: "",
          });
        }
      }
    })
    .on("end", async () => {
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
    });
};
