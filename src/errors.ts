// src/errors.ts
import { Token } from "./lexer";

export interface Location {
  line: number;
  column: number;
}

export interface SourceLocation {
  start: Location;
  end?: Location;
}

export class CompileError extends Error {
  constructor(
    public message: string,
    public location?: SourceLocation,
    public source?: string,
    public hint?: string
  ) {
    super(message);
    this.name = "CompileError";
  }

  format(): string {
    const lines: string[] = [];
    
    if (this.location) {
      const { line, column } = this.location.start;
      lines.push(`error at line ${line}, column ${column}:`);
      
      if (this.source) {
        const sourceLines = this.source.split("\n");
        const problemLine = sourceLines[line - 1];
        if (problemLine) {
          lines.push(`  ${line} | ${problemLine}`);
          lines.push(`    | ${" ".repeat(column - 1)}^`);
        }
      }
    } else {
      lines.push("error:");
    }
    
    lines.push(`  ${this.message}`);
    
    if (this.hint) {
      lines.push(`  hint: ${this.hint}`);
    }
    
    return lines.join("\n");
  }
}

export class CompileErrorCollector {
  errors: CompileError[] = [];

  addError(message: string, location?: SourceLocation, source?: string, hint?: string) {
    this.errors.push(new CompileError(message, location, source, hint));
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  format(): string {
    return this.errors.map(e => e.format()).join("\n\n");
  }

  throw() {
    if (this.hasErrors()) {
      const message = this.format();
      const error = new Error(message);
      error.name = "CompileErrors";
      throw error;
    }
  }
}

export function tokenToLocation(token: Token): SourceLocation {
  // Tokens don't have location info yet, but we can track it
  return { start: { line: 1, column: 1 } };
}
