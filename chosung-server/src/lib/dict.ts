import { XMLParser } from "fast-xml-parser";
import dotenv from "dotenv";
import { WordModel } from "../models/Word";

dotenv.config();

export interface DictCheckResult {
  exist: boolean;
  definition: string;
  pos?: string;
  processTime?: string;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  cdataPropName: "__cdata",
  parseTagValue: true,
  trimValues: true,
});

function parseNounDefinition(
  xmlData: any,
  targetWord: string,
): { exist: boolean; definition: string } {
  const items = xmlData?.channel?.item;
  if (!items) return { exist: false, definition: "명사가 아닙니다." };

  const itemList = Array.isArray(items) ? items : [items];

  const exactNounMatch = itemList.find((item: any) => {
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

    return (
      pureWord === targetWord && (finalPos.includes("명사") || finalPos === "")
    );
  });

  if (exactNounMatch) {
    let rawDefinition = exactNounMatch.sense
      ? Array.isArray(exactNounMatch.sense)
        ? exactNounMatch.sense[0].definition
        : exactNounMatch.sense.definition
      : exactNounMatch.definition;

    if (typeof rawDefinition === "object") {
      rawDefinition = rawDefinition["__cdata"] || rawDefinition["#text"] || "";
    }

    const cleanDefinition = String(rawDefinition)
      .replace(/<[^>]*>?/gm, "")
      .replace(/\s+/g, " ")
      .trim();

    if (cleanDefinition) {
      return { exist: true, definition: cleanDefinition };
    }
  }

  return { exist: false, definition: "명사가 아닙니다." };
}

export async function checkWordDetail(word: string): Promise<DictCheckResult> {
  const cleanWord = word.trim();
  const STDICT_API_KEY = process.env.STDICT_API_KEY;
  const KORDIC_API_KEY = process.env.KORDIC_API_KEY;

  const startTime = performance.now();

  try {
    const cachedWord = await WordModel.findOne({ word: cleanWord });
    if (
      cachedWord &&
      cachedWord.exist &&
      cachedWord.definition &&
      cachedWord.definition !== "뜻 정보 없음"
    ) {
      const endTime = performance.now();
      return {
        exist: cachedWord.exist,
        definition: cachedWord.definition,
        processTime: `${(endTime - startTime).toFixed(4)}ms (Cache HIT)`,
      };
    }

    let searchResult: DictCheckResult = {
      exist: false,
      definition: "명사가 아닙니다.",
    };

    if (STDICT_API_KEY) {
      const stdictUrl = `https://stdict.korean.go.kr/api/search.do?key=${STDICT_API_KEY}&req_type=xml&q=${encodeURIComponent(cleanWord)}`;
      const stdictResponse = await fetch(stdictUrl);
      const stdictXmlText = await stdictResponse.text();
      const stdictParsedData = xmlParser.parse(stdictXmlText);

      searchResult = parseNounDefinition(stdictParsedData, cleanWord);
    }

    if (!searchResult.exist && KORDIC_API_KEY) {
      const opendictUrl = `https://opendict.korean.go.kr/api/search?key=${KORDIC_API_KEY}&req_type=xml&q=${encodeURIComponent(cleanWord)}`;
      const opendictResponse = await fetch(opendictUrl);
      const opendictXmlText = await opendictResponse.text();
      const opendictParsedData = xmlParser.parse(opendictXmlText);

      searchResult = parseNounDefinition(opendictParsedData, cleanWord);
    }

    await WordModel.findOneAndUpdate(
      { word: cleanWord },
      { exist: searchResult.exist, definition: searchResult.definition },
      { upsert: true },
    );

    const endTime = performance.now();
    searchResult.processTime = `${(endTime - startTime).toFixed(4)}ms (API Call)`;

    return searchResult;
  } catch (err: any) {
    const endTime = performance.now();
    return {
      exist: false,
      definition: "데이터 처리 오류",
      processTime: `${(endTime - startTime).toFixed(4)}ms (Error)`,
    };
  }
}
