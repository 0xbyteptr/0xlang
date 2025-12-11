// src/parser.ts
import { lex, Token } from "./lexer";
import * as AST from "./ast";
import { CompileError } from "./errors";

export class Parser {
  tokens: Token[]; pos = 0; src: string;
  constructor(src: string) { this.src = src; this.tokens = lex(src); }
  peek() { return this.tokens[this.pos]; }
  next() { return this.tokens[this.pos++]; }
  
  private makeError(message: string, token?: Token): CompileError {
    const t = token || this.peek();
    return new CompileError(message, {
      start: { line: t.line, column: t.column }
    }, this.src);
  }
  
  eatSym(v: string) { 
    const t = this.peek(); 
    if(t.type==='sym' && t.value===v) {this.next(); return; } 
    const tokenStr = t.type === 'eof' ? 'EOF' : (t as any).value || t.type;
    throw this.makeError(`Expected '${v}', but got '${tokenStr}'`);
  }
  
  eatKw(v: string) { 
    const t = this.peek(); 
    if(t.type==='kw' && t.value===v) {this.next(); return; } 
    const tokenStr = t.type === 'eof' ? 'EOF' : (t as any).value || t.type;
    throw this.makeError(`Expected keyword '${v}', but got '${tokenStr}'`);
  }
  
  optionalSemi() { const t = this.peek(); if (t.type === "sym" && t.value === ";") this.next(); }
  parseProgram(): AST.Program {
    const body: AST.Stmt[] = [];
    while (this.peek().type !== "eof") body.push(this.parseTopLevel());
    return { body };
  }
  parseTopLevel(): AST.Stmt {
    const t = this.peek();
    if (t.type === "kw" && t.value === "import") return this.parseImport();
    if (t.type === "kw" && t.value === "class") return this.parseClass();
    if (t.type === "kw" && t.value === "let") return this.parseVarDecl();
    // optional: functions, etc.
    return this.parseExprStmt();
  }

  parseImport(): AST.ImportStmt {
    this.eatKw("import");
    const module = this.expectIdent();
    let alias: string | undefined;
    const t = this.peek();
    if (t.type === "kw" && t.value === "as") {
      this.next();
      alias = this.expectIdent();
    }
    this.optionalSemi();
    return { kind: "ImportStmt", module, alias };
  }
  parseClass(): AST.ClassDecl {
    this.eatKw("class");
    const name = this.expectIdent();
    let superName: string|undefined;
    const t1 = this.peek();
    if (t1.type === "kw" && t1.value === "extends") { this.next(); superName = this.expectIdent(); }
    this.eatSym("{");
    const members: AST.ClassMember[] = [];
    while (true) {
      const t = this.peek();
      if (t.type==="sym" && t.value==="}") break;
      if (t.type==="kw" && t.value==="constructor") {
        this.next();
        this.eatSym("(");
        const params = this.parseParams();
        this.eatSym(")");
        this.eatSym("{");
        const body = this.parseBlock();
        members.push({ kind: "ConstructorDecl", params, body });
        continue;
      }
      // field or method
      const id = this.expectIdent();
      const t2 = this.peek();
      if (t2.type === "sym" && t2.value === ":") {
        this.next();
        const typeName = this.expectIdent();
        this.optionalSemi();
        members.push({ kind: "FieldDecl", name: id, typeName });
      } else if (t2.type === "sym" && t2.value === "(") {
        // method
        this.next();
        const params = this.parseParams();
        this.eatSym(")");
        this.eatSym(":");
        const returnType = this.expectIdent();
        this.eatSym("{");
        const body = this.parseBlock();
        members.push({ kind: "MethodDecl", name: id, params, returnType, body });
      } else {
        throw this.makeError("Unexpected class member. Expected method or field declaration");

      }
    }
    this.eatSym("}");
    return { kind: "ClassDecl", name, superName, members };
  }

  parseParams(): AST.Param[] {
    const params: AST.Param[] = [];
    const t = this.peek();
    if (t.type === "sym" && t.value === ")") return params;
    while (true) {
      const name = this.expectIdent();
      this.eatSym(":");
      const typeName = this.expectIdent();
      params.push({ name, typeName });
      const t3 = this.peek();
      if (t3.type === "sym" && t3.value === ",") { this.next(); continue; }
      break;
    }
    return params;
  }

  parseBlock(): AST.Stmt[] {
    const stmts: AST.Stmt[] = [];
    while (true) {
      const t = this.peek();
      if (t.type==="sym" && t.value==="}") break;
      if (t.type==="kw" && t.value==="let") stmts.push(this.parseVarDecl());
      else if (t.type==="kw" && t.value==="if") stmts.push(this.parseIfStmt());
      else if (t.type==="kw" && t.value==="return") { this.next(); const t2 = this.peek(); const expr = t2.type==="sym" && t2.value===";" ? undefined : this.parseExpr(); this.optionalSemi(); stmts.push({ kind: "ReturnStmt", expr } as AST.ReturnStmt); }
      else stmts.push(this.parseExprStmt());
    }
    this.eatSym("}");
    return stmts;
  }

  parseIfStmt(): AST.IfStmt {
    this.eatKw("if");
    this.eatSym("(");
    const condition = this.parseExpr();
    this.eatSym(")");
    this.eatSym("{");
    const thenBody = this.parseBlock();
    let elseBody: AST.Stmt[] | undefined;
    const t = this.peek();
    if (t.type === "kw" && t.value === "else") {
      this.next();
      this.eatSym("{");
      elseBody = this.parseBlock();
    }
    return { kind: "IfStmt", condition, thenBody, elseBody } as AST.IfStmt;
  }

  parseVarDecl(): AST.VarDecl {
    this.eatKw("let");
    const name = this.expectIdent();
    this.eatSym(":");
    const typeName = this.expectIdent();
    let init;
    const t = this.peek();
    if (t.type === "sym" && t.value === "=") { this.next(); init = this.parseExpr(); }
    this.optionalSemi();
    return { kind: "VarDecl", name, typeName, init } as AST.VarDecl;
  }

  parseExprStmt(): AST.ExprStmt {
    const expr = this.parseExpr();
    this.optionalSemi();
    return { kind: "ExprStmt", expr };
  }

  parseExpr(): AST.Expr {
    return this.parseAssignment();
  }

  parseAssignment(): AST.Expr {
    let left = this.parseBinary();
    const t = this.peek();
    if (t.type === "sym" && t.value === "=") {
      this.next();
      const right = this.parseAssignment();
      return { kind: "AssignmentExpr", target: left, value: right } as AST.AssignmentExpr;
    }
    return left;
  }

  parsePrimary(): AST.Expr {
    const t = this.peek();
    if (t.type === "num") { this.next(); return { kind: "IntLiteral", value: Number(t.value) } as any; }
    if (t.type === "str") { this.next(); return { kind: "StringLiteral", value: t.value } as any; }
    if (t.type === "kw" && (t.value === "true" || t.value === "false")) { this.next(); return { kind: "BoolLiteral", value: t.value === "true" } as any; }
    if (t.type === "kw" && t.value === "this") { this.next(); let expr: AST.Expr = { kind: "ThisExpr" } as any; let t2 = this.peek(); while (t2.type === "sym" && (t2.value === "." || t2.value === "(")) { if (t2.value === ".") { this.next(); const field = this.expectIdent(); expr = { kind: "FieldAccessExpr", obj: expr, field } as AST.FieldAccessExpr; } else { this.next(); const args = this.parseArgs(); this.eatSym(")"); expr = { kind: "CallExpr", callee: expr, args } as AST.CallExpr; } t2 = this.peek(); } return expr; }
    if (t.type === "kw" && t.value === "super") { this.next(); let expr: AST.Expr = { kind: "SuperExpr" } as any; let t2 = this.peek(); while (t2.type === "sym" && (t2.value === "." || t2.value === "(")) { if (t2.value === ".") { this.next(); const field = this.expectIdent(); expr = { kind: "FieldAccessExpr", obj: expr, field } as AST.FieldAccessExpr; } else { this.next(); const args = this.parseArgs(); this.eatSym(")"); expr = { kind: "CallExpr", callee: expr, args } as AST.CallExpr; } t2 = this.peek(); } return expr; }
    if (t.type === "kw" && t.value === "new") {
      this.next();
      const className = this.expectIdent();
      this.eatSym("(");
      const args = this.parseArgs();
      this.eatSym(")");
      return { kind: "NewExpr", className, args } as AST.NewExpr;
    }
    if (t.type === "kw" && t.value === "print") {
      this.next();
      let expr: AST.Expr = { kind: "Identifier", name: "print" } as AST.IdentifierExpr;
      let t2 = this.peek();
      while (t2.type === "sym" && (t2.value === "." || t2.value === "(")) {
        if (t2.value === ".") {
          this.next();
          const field = this.expectIdent();
          expr = { kind: "FieldAccessExpr", obj: expr, field } as AST.FieldAccessExpr;
        } else {
          this.next();
          const args = this.parseArgs();
          this.eatSym(")");
          expr = { kind: "CallExpr", callee: expr, args } as AST.CallExpr;
        }
        t2 = this.peek();
      }
      return expr;
    }
    if (t.type === "ident") {
      this.next();
      let expr: AST.Expr = { kind: "Identifier", name: t.value } as AST.IdentifierExpr;
      let t2 = this.peek();
      while (t2.type === "sym" && (t2.value === "." || t2.value === "(")) {
        if (t2.value === ".") {
          this.next();
          const field = this.expectIdent();
          expr = { kind: "FieldAccessExpr", obj: expr, field } as AST.FieldAccessExpr;
        } else {
          // call
          this.next();
          const args = this.parseArgs();
          this.eatSym(")");
          expr = { kind: "CallExpr", callee: expr, args } as AST.CallExpr;
        }
        t2 = this.peek();
      }
      return expr;
    }
    const tokenStr = t.type === 'eof' ? 'EOF' : (t as any).value || t.type;
    throw this.makeError(`Unexpected token '${tokenStr}'. Expected expression, literal, or identifier`);

  }

  parseArgs(): AST.Expr[] {
    const args: AST.Expr[] = [];
    const t = this.peek();
    if (t.type === "sym" && t.value === ")") return args;
    while (true) {
      args.push(this.parseExpr());
      const t2 = this.peek();
      if (t2.type === "sym" && t2.value === ",") { this.next(); continue; }
      break;
    }
    return args;
  }

  parseUnary(): AST.Expr {
    const t = this.peek();
    if (t.type === "sym" && (t.value === "-" || t.value === "+")) {
      const op = (this.next() as any).value;
      const expr = this.parseUnary();
      return { kind: "UnaryExpr", op, expr } as AST.UnaryExpr;
    }
    return this.parsePrimary();
  }

  parseBinary(): AST.Expr {
    // super-simple: only + for now
    let left = this.parseUnary();
    let t = this.peek();
    while (t.type === "sym" && ["+", "-", "*", "/", "==", "!=", "<", ">", "<=", ">="].includes(t.value)) {
      const op = (this.next() as any).value;
      const right = this.parseUnary();
      left = { kind: "BinaryExpr", op, left, right } as AST.BinaryExpr;
      t = this.peek();
    }
    return left;
  }

  expectIdent(): string {
    const t = this.peek();
    if (t.type === "ident") { this.next(); return t.value; }
    const tokenStr = t.type === 'eof' ? 'EOF' : (t as any).value || t.type;
    throw this.makeError(`Expected identifier, but got '${tokenStr}'`);
  }
}
