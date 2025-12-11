// src/typecheck.ts
import * as AST from "./ast";

type TypeName = string;

interface ClassInfo {
  name: string;
  superName?: string;
  fields: Map<string, TypeName>;
  methods: Map<string, { params: TypeName[]; ret: TypeName }>;
  constructor?: { params: TypeName[] };
}

export class TypeChecker {
  classes = new Map<string, ClassInfo>();
  errors: string[] = [];

  check(program: AST.Program) {
    // pass 1: collect class headers
    for (const s of program.body) {
      if (s.kind === "ClassDecl") {
        if (this.classes.has(s.name)) this.errors.push(`Duplicate class ${s.name}`);
        const info: ClassInfo = { name: s.name, superName: s.superName, fields: new Map(), methods: new Map(), constructor: undefined };
        this.classes.set(s.name, info);
      }
    }
    // pass 2: fill members
    for (const s of program.body) {
      if (s.kind === "ClassDecl") {
        const info = this.classes.get(s.name)!;
        for (const m of s.members) {
          if (m.kind === "FieldDecl") info.fields.set(m.name, m.typeName);
          else if (m.kind === "MethodDecl") info.methods.set(m.name, { params: m.params.map(p => p.typeName), ret: m.returnType });
          else if (m.kind === "ConstructorDecl") info.constructor = { params: m.params.map(p => p.typeName) };
        }
      }
    }
    // pass 3: basic checks (e.g., super classes exist)
    for (const [name, info] of this.classes.entries()) {
      if (info.superName && !this.classes.has(info.superName)) this.errors.push(`Class ${name} extends unknown ${info.superName}`);
    }

    // NOTE: full method body type checking omitted for brevity — but you should walk method bodies, maintain local env mapping to types,
    // check expressions: identifier types, field access, calls, new, binary ops, return types match method signature etc.
    // Provide a simple example: check var declarations at top-level
    for (const s of program.body) {
      if (s.kind === "VarDecl") {
        if (!this.typeExists(s.typeName)) this.errors.push(`Unknown type ${s.typeName} in var ${s.name}`);
      }
    }

    return this.errors;
  }

  typeExists(t: TypeName) {
    if (["int", "Int", "string", "String", "bool", "Bool", "void", "Void"].includes(t)) return true;
    return this.classes.has(t);
  }

  isSubtype(a: TypeName, b: TypeName): boolean {
    if (a === b) return true;
    if (a === "Void" || b === "Void") return false;
    if (!this.classes.has(a) || !this.classes.has(b)) return false;
    let cur = this.classes.get(a)!.superName;
    while (cur) {
      if (cur === b) return true;
      cur = this.classes.get(cur)?.superName;
    }
    return false;
  }
}
