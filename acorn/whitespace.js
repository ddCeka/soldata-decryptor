// Matches a whole line break (where CRLF is considered a single
// line break). Used to count lines.

const lineBreak = /\r\n?|\n|\u2028|\u2029/
const lineBreakG = new RegExp(lineBreak.source, "g")

function isNewLine(code, ecma2019String) {
  return code === 10 || code === 13 || (!ecma2019String && (code === 0x2028 || code === 0x2029))
}

const nonASCIIwhitespace = /[\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff]/

const skipWhiteSpace = /(?:\s|\/\/.*|\/\*[^]*?\*\/)*/g


module.exports = {
  lineBreak: lineBreak,
  lineBreakG: lineBreakG,
  isNewLine: isNewLine,
  nonASCIIwhitespace: nonASCIIwhitespace,
  skipWhiteSpace: skipWhiteSpace,
};
