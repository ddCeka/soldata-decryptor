// Acorn is a tiny, fast JavaScript parser written in JavaScript.
//
// Acorn was written by Marijn Haverbeke, Ingvar Stepanyan, and
// various contributors and released under an MIT license.
//
// Git repositories for Acorn are available at
//
//     http://marijnhaverbeke.nl/git/acorn
//     https://github.com/acornjs/acorn.git
//
// Please use the [github bug tracker][ghbt] to report issues.
//
// [ghbt]: https://github.com/acornjs/acorn/issues
//
// [walk]: util/walk.js

require("./parseutil");
require("./statement");
require("./lval");
require("./expression");
require("./location");
require("./scope");

const Parser = require("./state").Parser;
const defaultOptions = require("./options").defaultOptions;
const Position = require("./locutil").Position;
const SourceLocation = require("./locutil").SourceLocation;
const getLineInfo = require("./locutil").getLineInfo;
const Node = require("./node").Node;
const TokenType = require("./tokentype").TokenType;
const tokTypes = require("./tokentype").types;
const keywordTypes = require("./tokentype").keywords;
const TokContext = require("./tokencontext").TokContext;
const tokContexts = require("./tokencontext").types;
const isIdentifierChar = require("./identifier").isIdentifierChar;
const isIdentifierStart = require("./identifier").isIdentifierStart;
const Token = require("./tokenize").Token;
const isNewLine = require("./whitespace").isNewLine;
const lineBreak = require("./whitespace").lineBreak;
const lineBreakG = require("./whitespace").lineBreakG;
const nonASCIIwhitespace = require("./whitespace").nonASCIIwhitespace;

const version = "7.0.0";

function parse(input, options) {
  return Parser.parse(input, options)
}

function parseExpressionAt(input, pos, options) {
  return Parser.parseExpressionAt(input, pos, options)
}

function tokenizer(input, options) {
  return Parser.tokenizer(input, options)
}

module.exports = {
  version: version,
  Parser: Parser,
  defaultOptions: defaultOptions,
  Position: Position,
  SourceLocation: SourceLocation,
  getLineInfo: getLineInfo,
  Node: Node,
  TokenType: TokenType,
  tokTypes: tokTypes,
  keywordTypes: keywordTypes,
  TokContext: TokContext,
  tokContexts: tokContexts,
  isIdentifierChar: isIdentifierChar,
  isIdentifierStart: isIdentifierStart,
  Token: Token,
  isNewLine: isNewLine,
  lineBreak: lineBreak,
  lineBreakG: lineBreakG,
  nonASCIIwhitespace: nonASCIIwhitespace,
  parse: parse,
  parseExpressionAt: parseExpressionAt,
  tokenizer: tokenizer,
};
