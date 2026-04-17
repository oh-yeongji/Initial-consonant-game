const HANGLE_START = 0xac00;
const HANGLE_END = 0xd7a3;

const FIRST_CHOSUNG_LIST = [
  "ㄱ",
  "ㄴ",
  "ㄷ",
  "ㅁ",
  "ㅂ",
  "ㅅ",
  "ㅇ",
  "ㅈ",
  "ㅎ",
];

const SECOND_CHOSUNG_LIST = [
  "ㄱ",
  "ㄴ",
  "ㄷ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅅ",
  "ㅇ",
  "ㅈ",
  "ㅎ",
];

const BLACKLIST = new Set([
  "ㄴㄹ",
  "ㄷㄹ",
  "ㅁㄹ",
  "ㅂㄹ",
  "ㅅㄹ",
  "ㅇㄹ",
  "ㅈㄹ",
  "ㅎㄹ",
  "ㄹㄹ",
  "ㄴㅎ",
  "ㄷㅎ",
  "ㅁㅎ",
  "ㅂㅎ",
  "ㅅㅎ",
  "ㅈㅎ",
  "ㅎㅎ",
  "ㄴㄷ",
  "ㄴㅂ",
  "ㄷㄴ",
  "ㅁㄴ",
  "ㅂㄴ",
]);

export function getRandomChosungPair(): [string, string] {
  let first: string;
  let second: string;
  let pair: string;

  while (true) {
    first =
      FIRST_CHOSUNG_LIST[Math.floor(Math.random() * FIRST_CHOSUNG_LIST.length)];
    second =
      SECOND_CHOSUNG_LIST[
        Math.floor(Math.random() * SECOND_CHOSUNG_LIST.length)
      ];
    pair = first + second;

    if (!BLACKLIST.has(pair)) {
      break;
    }
  }

  return [first, second];
}

const ALL_CHOSUNG = [
  "ㄱ",
  "ㄲ",
  "ㄴ",
  "ㄷ",
  "ㄸ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅃ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅉ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
];

export function extractTwoChosungs(word: string): [string, string] | null {
  const result: string[] = [];

  for (const char of word) {
    const code = char.charCodeAt(0);

    if (code < HANGLE_START || code > HANGLE_END) continue;

    const index = Math.floor((code - HANGLE_START) / 588);
    result.push(ALL_CHOSUNG[index]);

    if (result.length === 2) break;
  }
  return result.length === 2 ? [result[0], result[1]] : null;
}
