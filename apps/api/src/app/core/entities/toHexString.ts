export default function toHexString(value) {
  const hexTable = [];
  for (let i = 0; i < 256; i++) {
    hexTable[i] = (i <= 15 ? '0' : '') + i.toString(16);
  }

  const id = Object.keys(value.id).map(key => value.id[key]);

  let hexString = '';
  for (const el of id) {
    hexString += hexTable[el];
  }
  return hexString;
}
