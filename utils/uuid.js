// UUID v7 — time-ordered UUID
// Format: 48-bit timestamp | 4-bit version (7) | 12-bit random | 2-bit variant | 62-bit random
function uuidv7() {
  const now = BigInt(Date.now());

  // 48-bit timestamp in ms
  const tsMsHex = now.toString(16).padStart(12, '0');

  // random bytes (74 bits total needed)
  const rand = () => Math.floor(Math.random() * 16).toString(16);
  const randN = (n) => Array.from({ length: n }, rand).join('');

  const timeLow  = tsMsHex.slice(0, 8);           // 32 bits
  const timeMid  = tsMsHex.slice(8, 12);           // 16 bits
  const timeHigh = '7' + randN(3);                 // version 7 + 12 rand bits
  const clockSeq = (8 + Math.floor(Math.random() * 4)).toString(16) + randN(3); // variant + 14 bits
  const node     = randN(12);                      // 48 bits

  return `${timeLow}-${timeMid}-${timeHigh}-${clockSeq}-${node}`;
}

module.exports = { uuidv7 };
