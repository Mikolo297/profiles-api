function uuidv7() {
  const now = BigInt(Date.now());
  const tsMsHex = now.toString(16).padStart(12, '0');
  const rand = () => Math.floor(Math.random() * 16).toString(16);
  const randN = (n) => Array.from({ length: n }, rand).join('');
  const timeLow  = tsMsHex.slice(0, 8);
  const timeMid  = tsMsHex.slice(8, 12);
  const timeHigh = '7' + randN(3);
  const clockSeq = (8 + Math.floor(Math.random() * 4)).toString(16) + randN(3);
  const node     = randN(12);
  return `${timeLow}-${timeMid}-${timeHigh}-${clockSeq}-${node}`;
}

module.exports = { uuidv7 };
