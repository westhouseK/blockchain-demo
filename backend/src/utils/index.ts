import _ from "lodash";
import Encoding from "encoding-japanese";

export const sortedObjectByKey = (unsortedObject: { [s: string]: any }) => {
  const sortedKeys = Object.keys(unsortedObject).sort();
  const sortedObject: { [s: string]: any } = {};

  for (let key of sortedKeys) {
    sortedObject[key] = unsortedObject[key];
  }

  return sortedObject;
}

export const convertToUtf8 = (value: string): string => {
  let str = value;
  // 文字列から文字コード値の配列に変換
  const unicodeArray = Encoding.stringToCode(str);
  const detectedEncoding = Encoding.detect(unicodeArray);
  if (detectedEncoding !== "UTF8") {
    const utf8Array = Encoding.convert(unicodeArray, {
      to: "UTF8",
      from: detectedEncoding as Encoding.Encoding,
    });
    return Encoding.codeToString(utf8Array);
  }
  return str;
};