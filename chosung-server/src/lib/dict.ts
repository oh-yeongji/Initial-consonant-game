import { XMLParser } from "fast-xml-parser";
import dotenv from "dotenv";
import { WordModel } from "../models/Word";

dotenv.config();

export interface DictCheckResult {
  exist: boolean;
  definition: string;
}

export async function clearWordDatabase() {
  try {
    await WordModel.deleteMany({});
    console.log(" DB 초기화 완료: 모든 단어 데이터를 삭제했습니다.");
  } catch (err) {
    console.error(" DB 초기화 실패:", err);
  }
}

export async function checkWordDetail(word: string): Promise<DictCheckResult> {
  const cleanWord = word.trim();
  const API_KEY = process.env.KORDIC_API_KEY;

  try {
    const cached = await WordModel.findOne({ word: cleanWord });
    if (cached && cached.definition && cached.definition !== "뜻 정보 없음") {
      console.log(`[Cache Hit] DB에서 가져옴: ${cleanWord}`);
      return { exist: cached.exist, definition: cached.definition };
    }

    const url = `https://stdict.korean.go.kr/api/search.do?key=${API_KEY}&req_type=xml&q=${encodeURIComponent(cleanWord)}&method=exact`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, { signal: controller.signal });
    const raw = await res.text();
    clearTimeout(timeoutId);

    const parser = new XMLParser({
      ignoreAttributes: false,
      cdataPropName: "__cdata",
      parseTagValue: true,
    });

    const data = parser.parse(raw);
    const items = data?.channel?.item;

    let result: DictCheckResult = { exist: false, definition: "" };

    if (items) {
      const itemList = Array.isArray(items) ? items : [items];
      const firstItem = itemList[0];

      const senseData = Array.isArray(firstItem.sense)
        ? firstItem.sense[0]
        : firstItem.sense;

      let rawDef = senseData?.definition || firstItem.definition || "";
      if (typeof rawDef === "object" && rawDef !== null) {
        rawDef = rawDef["__cdata"] || rawDef["#text"] || JSON.stringify(rawDef);
      }

      const finalDef = String(rawDef)
        .replace(/<[^>]*>?/gm, "")
        .trim();

      result = {
        exist: finalDef.length > 0,
        definition: finalDef || "뜻 정보 없음",
      };
    }

    const updatedDoc = await WordModel.findOneAndUpdate(
      { word: cleanWord },
      {
        exist: result.exist,
        definition: result.definition,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );

    console.log(
      `[DB Saved] 단어: ${updatedDoc.word}, 뜻 존재: ${updatedDoc.exist}`,
    );
    return result;
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.error(`[Timeout] ${cleanWord} - API 응답 시간 초과`);
    } else {
      console.error(`[Error] ${cleanWord}:`, err.message);
    }
    return { exist: false, definition: "" };
  }
}
