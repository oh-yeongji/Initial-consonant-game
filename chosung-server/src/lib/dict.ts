import { XMLParser } from "fast-xml-parser";
import dotenv from "dotenv";
import { WordModel } from "../models/Word";

dotenv.config();

export interface DictCheckResult {
  exist: boolean;
  definition: string;
  pos?: string;
  debug?: {
    total: number;
    db?: number;
    api?: number;
    type: "HIT" | "MISS";
  };
}

export async function checkWordDetail(word: string): Promise<DictCheckResult> {
  const cleanWord = word.trim();
  const API_KEY = process.env.KORDIC_API_KEY;

  const totalStart = performance.now();

  try {
    const dbStart = performance.now();
    const cached = await WordModel.findOne({ word: cleanWord });
    const dbEnd = performance.now();

    if (
      cached &&
      cached.exist &&
      cached.definition &&
      cached.definition !== "뜻 정보 없음"
    ) {
      const totalEnd = performance.now();

      return {
        exist: cached.exist,
        definition: cached.definition,
        debug: {
          total: totalEnd - totalStart,
          db: dbEnd - dbStart,
          type: "HIT",
        },
      };
    }

    const apiStart = performance.now();
    const url = `https://stdict.korean.go.kr/api/search.do?key=${API_KEY}&req_type=xml&q=${encodeURIComponent(cleanWord)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(url, { signal: controller.signal });
    const raw = await res.text();
    clearTimeout(timeoutId);

    const apiEnd = performance.now();

    const parser = new XMLParser({
      ignoreAttributes: false,
      cdataPropName: "__cdata",
      parseTagValue: true,
      trimValues: true,
    });

    const data = parser.parse(raw);
    const items = data?.channel?.item;

    let result: DictCheckResult = {
      exist: false,
      definition: "명사가 아닙니다.",
    };

    if (items) {
      const itemList = Array.isArray(items) ? items : [items];

      const exactMatch = itemList.find((item: any) => {
        let rawApiWord = item.word;
        if (typeof rawApiWord === "object") {
          rawApiWord =
            rawApiWord["__cdata"] ||
            rawApiWord["#text"] ||
            String(Object.values(rawApiWord)[0]);
        }

        const pureWord = String(rawApiWord)
          .replace(/[0-9\[\]]/g, "")
          .trim();

        let posInfo = item.pos;
        if (typeof posInfo === "object") {
          posInfo = posInfo["__cdata"] || posInfo["#text"] || "";
        }
        const finalPos = String(posInfo || "").trim();

        return pureWord === cleanWord && finalPos.includes("명사");
      });

      if (exactMatch) {
        let rawDef = exactMatch.sense
          ? Array.isArray(exactMatch.sense)
            ? exactMatch.sense[0].definition
            : exactMatch.sense.definition
          : exactMatch.definition;

        if (typeof rawDef === "object") {
          rawDef = rawDef["__cdata"] || rawDef["#text"] || "";
        }

        const finalDef = String(rawDef)
          .replace(/<[^>]*>?/gm, "")
          .replace(/\s+/g, " ")
          .trim();

        if (finalDef) {
          result = { exist: true, definition: finalDef };
        }
      }
    }

    if (!result.exist && result.definition === "") {
      result.definition = "뜻 정보 없음";
    }

    await WordModel.findOneAndUpdate(
      { word: cleanWord },
      { exist: result.exist, definition: result.definition },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );

    const totalEnd = performance.now();

    return {
      ...result,
      debug: {
        total: totalEnd - totalStart,
        api: apiEnd - apiStart,
        type: "MISS",
      },
    };
  } catch (err: any) {
    return {
      exist: false,
      definition: "데이터 처리 오류",
    };
  }
}
