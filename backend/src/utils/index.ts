export const sortedObjectByKey = (unsortedObject: { [s: string]: any }): { [s: string]: any } => {
  const sortedKeys = Object.keys(unsortedObject).sort();
  const sortedObject: { [s: string]: any } = {};

  for (let key of sortedKeys) {
    sortedObject[key] = unsortedObject[key];
  }

  return sortedObject;
}

export const convertToUtf8 = (input: string) => {
  const encoder = new TextEncoder();
  const utf8Array = encoder.encode(input);
  return utf8Array;
}