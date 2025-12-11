// src/runtime.ts
import * as AST from "./ast";

type Value =
  | { kind: "int"; value: number }
  | { kind: "string"; value: string }
  | { kind: "bool"; value: boolean }
  | { kind: "object"; className: string; fields: Map<string, Value> }
  | { kind: "class"; className: string }
  | { kind: "null" };

export class Runtime {
  classes: Map<string, AST.ClassDecl>;
  globals = new Map<string, Value>();
  returnValue: Value | null = null;
  hasReturned: boolean = false;

  constructor(program: AST.Program) {
    this.classes = new Map(program.body.filter(s => s.kind==="ClassDecl").map(s => [s.name, s] as [string, AST.ClassDecl]));
    // Register all classes as globals so they can be referenced
    for (const [className, _] of this.classes) {
      this.globals.set(className, { kind: "class", className });
    }
  }

  run(program: AST.Program) {
    // execute top-level var decls and exprstmts
    for (const s of program.body) {
      this.execStmt(s);
      if (this.hasReturned) break;
    }
  }

  execStmt(s: AST.Stmt, target: Map<string, Value> = this.globals): boolean {
    if (s.kind === "ImportStmt") {
      // Imports are handled at module load time
      return false;
    } else if (s.kind === "VarDecl") {
      const val = s.init ? this.evalExpr(s.init, target) : { kind: "null" } as Value;
      target.set(s.name, val);
      return false; // no return
    } else if (s.kind === "ExprStmt") {
      this.evalExpr(s.expr, target);
      return false; // no return
    } else if (s.kind === "ReturnStmt") {
      return true; // signal return
    } else if (s.kind === "IfStmt") {
      const cond = this.evalExpr(s.condition, target);
      const isTruthy = (cond.kind === "int" && cond.value !== 0) || (cond.kind === "bool" && cond.value);
      if (isTruthy) {
        for (const stmt of s.thenBody) {
          if (this.execStmt(stmt, target)) return true;
        }
      } else if (s.elseBody) {
        for (const stmt of s.elseBody) {
          if (this.execStmt(stmt, target)) return true;
        }
      }
      return false;
    }
    return false;
  }

  evalExpr(e: AST.Expr, target: Map<string, Value> = this.globals): Value {
    switch (e.kind) {
      case "IntLiteral": return { kind: "int", value: e.value };
      case "StringLiteral": return { kind: "string", value: e.value };
      case "BoolLiteral": return { kind: "bool", value: e.value };
      case "Identifier": {
        if (this.globals.has(e.name)) return this.globals.get(e.name)!;
        throw new Error("Unknown identifier " + e.name);
      }
      case "NewExpr": {
        const cls = this.classes.get(e.className);
        if (!cls) throw new Error("Unknown class " + e.className);
        // create object with default null fields
        const fields = new Map<string, Value>();
        for (const m of cls.members) if (m.kind === "FieldDecl") fields.set(m.name, { kind: "null" });
        const obj: Value = { kind: "object", className: e.className, fields };
        // call constructor if present
        const ctor = cls.members.find(m => m.kind === "ConstructorDecl") as AST.ConstructorDecl | undefined;
        if (ctor) {
          // set `this` in a temporary env and evaluate body — simplified: we don't support params here fully
          // TODO: handle ctor params and evaluation environment
        }
        return obj;
      }
      case "FieldAccessExpr": {
        const o = this.evalExpr(e.obj, target);
        if (o.kind === "object") {
          return o.fields.get(e.field) ?? { kind: "null" };
        } else if (o.kind === "class") {
          // Class method access - return a reference for later call
          return { kind: "class", className: o.className };
        }
        throw new Error("Invalid field access on non-object");
      }
      case "CallExpr": {
        // support builtin print
        if (e.callee.kind === "Identifier" && e.callee.name === "print") {
          const args = e.args.map(a => this.evalExpr(a, target));
          console.log(...args.map(this.valToString));
          return { kind: "null" };
        }
        // method call: callee may be FieldAccessExpr or Identifier (static func)
        if (e.callee.kind === "FieldAccessExpr") {
          const obj = this.evalExpr(e.callee.obj, target);
          const methodName = e.callee.field;
          
          if (obj.kind === "class") {
            // Static method call on a class
            const method = this.findMethod(obj.className, methodName);
            if (!method) throw new Error(`Method ${methodName} not found on class ${obj.className}`);
            
            // Evaluate the method with the arguments
            const args = e.args.map(a => this.evalExpr(a, target));
            const localEnv = new Map(target);
            
            // Bind parameters
            for (let i = 0; i < method.params.length && i < args.length; i++) {
              localEnv.set(method.params[i].name, args[i]);
            }
            
            // Execute method body
            let result: Value = { kind: "null" };
            for (const stmt of method.body) {
              if (stmt.kind === "ReturnStmt") {
                result = stmt.expr ? this.evalExpr(stmt.expr, localEnv) : { kind: "null" };
                break;
              } else {
                this.execStmt(stmt, localEnv);
              }
            }
            return result;
          } else if (obj.kind === "object") {
            // Instance method call on an object
            const method = this.findMethod(obj.className, methodName);
            if (!method) throw new Error(`Method ${methodName} not found on ${obj.className}`);
            
            const args = e.args.map(a => this.evalExpr(a, target));
            const localEnv = new Map(target);
            localEnv.set("this", obj);
            
            // Bind parameters
            for (let i = 0; i < method.params.length && i < args.length; i++) {
              localEnv.set(method.params[i].name, args[i]);
            }
            
            // Execute method body
            let result: Value = { kind: "null" };
            for (const stmt of method.body) {
              if (stmt.kind === "ReturnStmt") {
                result = stmt.expr ? this.evalExpr(stmt.expr, localEnv) : { kind: "null" };
                break;
              } else {
                this.execStmt(stmt, localEnv);
              }
            }
            return result;
          }
          throw new Error("Call on non-object/non-class");
        }
        throw new Error("Unsupported call form");
      }
      case "BinaryExpr": {
        const l = this.evalExpr(e.left, target);
        const r = this.evalExpr(e.right, target);
        if (e.op === "+") {
          if (l.kind === "string" || r.kind === "string") return { kind: "string", value: this.valToString(l) + this.valToString(r) };
          if (l.kind === "int" && r.kind === "int") return { kind: "int", value: l.value + r.value };
        } else if (e.op === "-" && l.kind === "int" && r.kind === "int") {
          return { kind: "int", value: l.value - r.value };
        } else if (e.op === "*" && l.kind === "int" && r.kind === "int") {
          return { kind: "int", value: l.value * r.value };
        } else if (e.op === "/" && l.kind === "int" && r.kind === "int") {
          return { kind: "int", value: Math.floor(l.value / r.value) };
        } else if (e.op === "==" && l.kind === "int" && r.kind === "int") {
          return { kind: "int", value: l.value === r.value ? 1 : 0 };
        } else if (e.op === "!=" && l.kind === "int" && r.kind === "int") {
          return { kind: "int", value: l.value !== r.value ? 1 : 0 };
        } else if (e.op === "<" && l.kind === "int" && r.kind === "int") {
          return { kind: "int", value: l.value < r.value ? 1 : 0 };
        } else if (e.op === ">" && l.kind === "int" && r.kind === "int") {
          return { kind: "int", value: l.value > r.value ? 1 : 0 };
        } else if (e.op === "<=" && l.kind === "int" && r.kind === "int") {
          return { kind: "int", value: l.value <= r.value ? 1 : 0 };
        } else if (e.op === ">=" && l.kind === "int" && r.kind === "int") {
          return { kind: "int", value: l.value >= r.value ? 1 : 0 };
        }
        throw new Error("Unsupported binary op or operand types");
      }
      case "UnaryExpr": {
        const operand = this.evalExpr(e.expr, target);
        if (e.op === "-") {
          if (operand.kind === "int") return { kind: "int", value: -operand.value };
        } else if (e.op === "+") {
          if (operand.kind === "int") return { kind: "int", value: operand.value };
        }
        throw new Error("Unsupported unary op or operand type");
      }
      case "AssignmentExpr": {
        const val = this.evalExpr(e.value, target);
        if (e.target.kind === "Identifier") {
          target.set(e.target.name, val);
        } else if (e.target.kind === "FieldAccessExpr") {
          const obj = this.evalExpr(e.target.obj, target);
          if (obj.kind !== "object") throw new Error("Cannot assign to field of non-object");
          obj.fields.set(e.target.field, val);
        } else {
          throw new Error("Invalid assignment target");
        }
        return val;
      }
      default: throw new Error("Eval not implemented for " + (e as any).kind);
    }
  }

  findMethod(className: string, methodName: string): AST.MethodDecl | undefined {
    let cls = this.classes.get(className);
    while (cls) {
      const m = cls.members.find(mem => mem.kind === "MethodDecl" && mem.name === methodName) as AST.MethodDecl | undefined;
      if (m) return m;
      if (!cls.superName) break;
      cls = this.classes.get(cls.superName);
    }
    return undefined;
  }

  valToString(v: Value) {
    if (v.kind === "int") return String(v.value);
    if (v.kind === "string") return v.value;
    if (v.kind === "bool") return v.value ? "true" : "false";
    if (v.kind === "object") return `<${v.className} object>`;
    return "null";
  }
}
