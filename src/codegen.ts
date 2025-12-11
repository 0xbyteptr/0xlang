// src/codegen.ts
import * as AST from "./ast";
import { standardLibraryC } from "./std/stdlib";

export class CodeGenerator {
  code: string[] = [];
  indent = 0;

  generate(program: AST.Program): string {
    this.emit("#include <stdio.h>");
    this.emit("#include <stdlib.h>");
    this.emit("#include <string.h>");
    this.emit("");
    
    // Include standard library
    this.code.push(standardLibraryC);
    this.emit("");
    
    // Find all classes and generate structs
    const classes = program.body.filter(s => s.kind === "ClassDecl") as AST.ClassDecl[];
    
    // Forward declarations
    for (const cls of classes) {
      this.emit(`struct ${cls.name};`);
    }
    this.emit("");
    
    // Struct definitions
    for (const cls of classes) {
      this.emit(`struct ${cls.name} {`);
      this.indent++;
      for (const member of cls.members) {
        if (member.kind === "FieldDecl") {
          const ctype = this.typeNameToCType(member.typeName);
          this.emit(`${ctype} ${member.name};`);
        }
      }
      this.indent--;
      this.emit("};");
      this.emit("");
    }
    
    // Method forward declarations
    for (const cls of classes) {
      for (const member of cls.members) {
        if (member.kind === "MethodDecl") {
          const retType = this.typeNameToCType(member.returnType);
          const params = member.params
            .map(p => `${this.typeNameToCType(p.typeName)} ${p.name}`).join(", ");
          this.emit(`${retType} ${cls.name}_${member.name}(${params});`);
        }
      }
    }
    this.emit("");
    
    // Method implementations
    for (const cls of classes) {
      for (const member of cls.members) {
        if (member.kind === "MethodDecl") {
          const retType = this.typeNameToCType(member.returnType);
          const params = member.params
            .map(p => `${this.typeNameToCType(p.typeName)} ${p.name}`).join(", ");
          this.emit(`${retType} ${cls.name}_${member.name}(${params}) {`);
          this.indent++;
          this.emitBlock(member.body);
          this.indent--;
          this.emit("}");
          this.emit("");
        }
      }
    }
    
    // Constructors
    for (const cls of classes) {
      const ctor = cls.members.find(m => m.kind === "ConstructorDecl") as AST.ConstructorDecl | undefined;
      const params = (ctor?.params || []).map(p => `${this.typeNameToCType(p.typeName)} ${p.name}`).join(", ");
      this.emit(`struct ${cls.name}* ${cls.name}_new(${params}) {`);
      this.indent++;
      this.emit(`struct ${cls.name}* obj = malloc(sizeof(struct ${cls.name}));`);
      if (ctor) {
        this.emitBlock(ctor.body);
      }
      this.emit(`return obj;`);
      this.indent--;
      this.emit("}");
      this.emit("");
    }
    
    // Main function
    this.emit("int main() {");
    this.indent++;
    for (const stmt of program.body) {
      if (stmt.kind === "VarDecl") {
        this.emitStmt(stmt);
      } else if (stmt.kind === "ExprStmt") {
        this.emitStmt(stmt);
      }
    }
    this.emit("return 0;");
    this.indent--;
    this.emit("}");
    
    return this.code.join("\n");
  }

  emitBlock(stmts: AST.Stmt[]) {
    for (const stmt of stmts) {
      this.emitStmt(stmt);
    }
  }

  emitStmt(stmt: AST.Stmt) {
    if (stmt.kind === "ImportStmt") {
      // Imports are handled at the module level, skip in code generation
      return;
    } else if (stmt.kind === "VarDecl") {
      const ctype = this.typeNameToCType(stmt.typeName);
      if (stmt.init) {
        this.emit(`${ctype} ${stmt.name} = ${this.emitExpr(stmt.init)};`);
      } else {
        this.emit(`${ctype} ${stmt.name};`);
      }
    } else if (stmt.kind === "ExprStmt") {
      this.emit(`${this.emitExpr(stmt.expr)};`);
    } else if (stmt.kind === "ReturnStmt") {
      if (stmt.expr) {
        this.emit(`return ${this.emitExpr(stmt.expr)};`);
      } else {
        this.emit(`return;`);
      }
    } else if (stmt.kind === "IfStmt") {
      this.emit(`if (${this.emitExpr(stmt.condition)}) {`);
      this.indent++;
      this.emitBlock(stmt.thenBody);
      this.indent--;
      if (stmt.elseBody) {
        this.emit("} else {");
        this.indent++;
        this.emitBlock(stmt.elseBody);
        this.indent--;
      }
      this.emit("}");
    }
  }

  emitExpr(expr: AST.Expr): string {
    switch (expr.kind) {
      case "IntLiteral":
        return String(expr.value);
      case "StringLiteral":
        return `"${expr.value.replace(/"/g, '\\"')}"`;
      case "BoolLiteral":
        return expr.value ? "1" : "0";
      case "Identifier":
        return expr.name;
      case "BinaryExpr": {
        const left = this.emitExpr(expr.left);
        const right = this.emitExpr(expr.right);
        const op = expr.op === "==" ? "==" : expr.op === "!=" ? "!=" : expr.op;
        return `(${left} ${op} ${right})`;
      }
      case "UnaryExpr": {
        const operand = this.emitExpr(expr.expr);
        return `(${expr.op}${operand})`;
      }
      case "CallExpr": {
        if (expr.callee.kind === "Identifier" && expr.callee.name === "print") {
          // Handle print function - infer format based on expression type
          const args = expr.args.map(a => this.emitExpr(a));
          if (args.length === 0) {
            return `printf("\\n")`;
          } else {
            // Simple heuristic: use %d for numeric types, %s for strings
            const formats = expr.args.map(a => {
              if (a.kind === "IntLiteral" || a.kind === "BinaryExpr" || a.kind === "UnaryExpr" || a.kind === "CallExpr") return "%d";
              if (a.kind === "StringLiteral") return "%s";
              if (a.kind === "Identifier") return "%d"; // assume identifiers are numeric by default
              return "%s"; // default fallback
            });
            return `printf("${formats.join(" ")}\\n", ${args.join(", ")})`;
          }
        }
        if (expr.callee.kind === "FieldAccessExpr") {
          const method = expr.callee.field;
          const objName = expr.callee.obj.kind === "Identifier" ? (expr.callee.obj as any).name : "obj";
          const args = expr.args.map(a => this.emitExpr(a)).join(", ");
          return `${objName}_${method}(${args})`;
        }
        throw new Error(`Unsupported call: ${(expr as any).kind}`);
      }
      case "FieldAccessExpr": {
        const obj = this.emitExpr(expr.obj);
        return `${obj}.${expr.field}`;
      }
      case "NewExpr": {
        const args = expr.args.map(a => this.emitExpr(a)).join(", ");
        return `${expr.className}_new(${args})`;
      }
      case "ThisExpr":
        return "this";
      case "SuperExpr":
        return "super";
      case "AssignmentExpr": {
        const target = this.emitExpr(expr.target);
        const value = this.emitExpr(expr.value);
        return `(${target} = ${value})`;
      }
      default:
        throw new Error(`Unsupported expression: ${(expr as any).kind}`);
    }
  }

  typeNameToCType(typeName: string): string {
    switch (typeName.toLowerCase()) {
      case "int": return "int";
      case "string": return "char*";
      case "bool": return "int";
      case "void": return "void";
      default: return `struct ${typeName}*`;
    }
  }

  emit(line: string) {
    const indentStr = "  ".repeat(this.indent);
    this.code.push(indentStr + line);
  }
}
