// src/lexer.ts
export interface Location {
  line: number;
  column: number;
}

export type Token =
  | { type: "num"; value: string; line: number; column: number }
  | { type: "ident"; value: string; line: number; column: number }
  | { type: "str"; value: string; line: number; column: number }
  | { type: "kw"; value: string; line: number; column: number }
  | { type: "sym"; value: string; line: number; column: number }
  | { type: "eof"; line: number; column: number };

const keywords = new Set([
  "class","extends","constructor","let","new","return","super","this","true","false","if","else","import", "as"
]);

export function lex(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let column = 1;

  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) { 
      if (ch === '\n') { line++; column = 1; }
      else { column++; }
      i++;
      continue;
    }
    if (ch === '/' && input[i+1] === '/') { // comment
      while (i < input.length && input[i] !== '\n') i++;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      const startCol = column;
      let j = i;
      while (j < input.length && /[0-9]/.test(input[j])) j++;
      tokens.push({ type: "num", value: input.slice(i, j), line, column: startCol });
      column += j - i;
      i = j; continue;
    }
    if (ch === '"' || ch === "'") {
      const startCol = column;
      const quote = ch; let j = i+1; let str = "";
      while (j < input.length && input[j] !== quote) {
        if (input[j] === '\\') { j++; if (j < input.length) { str += input[j]; j++; } }
        else { str += input[j]; j++; }
      }
      i = j+1;
      tokens.push({ type: "str", value: str, line, column: startCol });
      column += i - (j - str.length);
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const startCol = column;
      let j = i;
      while (j < input.length && /[A-Za-z0-9_]/.test(input[j])) j++;
      const word = input.slice(i, j);
      if (keywords.has(word)) tokens.push({ type: "kw", value: word, line, column: startCol });
      else tokens.push({ type: "ident", value: word, line, column: startCol });
      column += j - i;
      i = j; continue;
    }
    // symbols
    const startCol = column;
    const two = input.slice(i, i+2);
    if (["==","!=","<=" , ">=" , "&&","||","->"].includes(two)) { 
      tokens.push({type:"sym", value:two, line, column: startCol}); 
      column += 2;
      i+=2; 
      continue; 
    }
    tokens.push({ type: "sym", value: ch, line, column: startCol });
    column++;
    i++;
  }
  tokens.push({ type: "eof", line, column });
  return tokens;
}
