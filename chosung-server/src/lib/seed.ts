import dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import * as XLSX from "xlsx";
import { WordModel } from "../models/Word";
import { extractTwoChosungs } from "../game/chosung";

const MONGODB_URI = process.env.MONGODB_URI;
const DATA_DIR_PATH = path.join(process.cwd(), "src", "data");

export const seedWordsFromXLSX = async () => {
  if (!fs.existsSync(DATA_DIR_PATH)) {
    console.error(`❌ [에러] 폴더를 찾을 수 없음: ${DATA_DIR_PATH}`);
    return;
  }

  // await WordModel.deleteMany({});
  // console.log("🗑️ 기존 데이터 삭제 완료");

  const files = fs.readdirSync(DATA_DIR_PATH).filter((file) => {
    const lower = file.toLowerCase();
    return lower.endsWith(".xlsx") || lower.endsWith(".xls");
  });

  console.log(`📁 감지된 파일 목록:`, files);

  if (files.length === 0) {
    console.error(
      "❌ [에러] src/data 폴더 안에 .xls 또는 .xlsx 파일이 없습니다.",
    );
    return;
  }

  const results: any[] = [];

  for (const file of files) {
    const filePath = path.join(DATA_DIR_PATH, file);
    console.log(`📄 파일 읽는 중: ${file}`);
    const workbook = XLSX.readFile(filePath);

    for (const sheetName of workbook.SheetNames) {
      const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

      for (const row of rows) {
        const wordRaw = row["어휘"] ? String(row["어휘"]) : "";
        const pos = row["품사"] ? String(row["품사"]) : "";

        if (!wordRaw) continue;

        const cleanWord = wordRaw
          .split("/")[0]
          .replace(/[^가-힣]/g, "")
          .trim();

        if (cleanWord.length === 2 && (!pos || pos.includes("명사"))) {
          const chosungTuple = extractTwoChosungs(cleanWord);
          if (!chosungTuple) continue;

          results.push({
            word: cleanWord,
            initials: chosungTuple.join(""),
            length: cleanWord.length,
            level: row["난이도"] || "보통",
            exist: true,
            original: wordRaw,
            definition: row["뜻풀이"] || "",
          });
        }
      }
    }
  }

  const uniqueResults = Array.from(
    new Map(results.map((item) => [item.word, item])).values(),
  );

  if (uniqueResults.length > 0) {
    try {
      await WordModel.insertMany(uniqueResults, { ordered: false });
      console.log("✅ DB 저장 성공!");
    } catch (err: any) {
      if (err.code === 11000 || err.writeErrors) {
        console.log(
          "⚠️ 일부 중복된 단어를 제외하고 새로 추가된 단어가 저장되었습니다.",
        );
      } else {
        throw err;
      }
    }
  } else {
    console.warn(
      "⚠️ 추출된 단어가 0개입니다. 엑셀의 열 이름이 '어휘', '품사'가 맞는지 확인해 주세요.",
    );
  }
};

const run = async () => {
  try {
    if (!MONGODB_URI) {
      throw new Error("❌ .env 파일에 MONGODB_URI가 설정되지 않았습니다.");
    }
    console.log("🔌 MongoDB 연결 시도 중...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ MongoDB 연결 완료!");

    await seedWordsFromXLSX();

    const totalCount = await WordModel.countDocuments();

    console.log("\n==========================================");
    console.log(`📊 DB 내 총 단어 수: ${totalCount.toLocaleString()}개`);
    console.log("==========================================\n");
  } catch (err) {
    console.error("❌ 실행 과정 중 에러 발생:", err);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 DB 연결 종료.");
    process.exit(0);
  }
};

run();
