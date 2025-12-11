// src/ast.ts
export type Identifier = string;

export interface Program { body: Stmt[]; }

export type Stmt =
  | ImportStmt
  | ClassDecl
  | VarDecl
  | FuncDecl
  | ExprStmt
  | ReturnStmt
  | IfStmt;

export interface ImportStmt {
  kind: "ImportStmt";
  module: string;
  alias?: string;
}

export interface ClassDecl {
  kind: "ClassDecl";
  name: Identifier;
  superName?: Identifier;
  members: ClassMember[];
}

export type ClassMember = FieldDecl | MethodDecl | ConstructorDecl;

export interface FieldDecl {
  kind: "FieldDecl";
  name: Identifier;
  typeName: Identifier;
}

export interface MethodDecl {
  kind: "MethodDecl";
  name: Identifier;
  params: Param[];
  returnType: Identifier;
  body: Stmt[];
}

export interface ConstructorDecl {
  kind: "ConstructorDecl";
  params: Param[];
  body: Stmt[];
}

export interface Param { name: Identifier; typeName: Identifier; }

export interface VarDecl {
  kind: "VarDecl";
  name: Identifier;
  typeName: Identifier;
  init?: Expr;
}

export interface FuncDecl {
  kind: "FuncDecl";
  name: Identifier;
  params: Param[];
  returnType: Identifier;
  body: Stmt[];
}

export interface ExprStmt { kind: "ExprStmt"; expr: Expr; }

export interface ReturnStmt { kind: "ReturnStmt"; expr?: Expr; }

export interface IfStmt { kind: "IfStmt"; condition: Expr; thenBody: Stmt[]; elseBody?: Stmt[]; }

export type Expr =
  | IntLiteral
  | StringLiteral
  | BoolLiteral
  | IdentifierExpr
  | BinaryExpr
  | UnaryExpr
  | CallExpr
  | NewExpr
  | FieldAccessExpr
  | ThisExpr
  | SuperExpr
  | AssignmentExpr;

export interface IntLiteral { kind: "IntLiteral"; value: number; }
export interface StringLiteral { kind: "StringLiteral"; value: string; }
export interface BoolLiteral { kind: "BoolLiteral"; value: boolean; }
export interface IdentifierExpr { kind: "Identifier"; name: Identifier; }
export interface BinaryExpr { kind: "BinaryExpr"; op: string; left: Expr; right: Expr; }
export interface UnaryExpr { kind: "UnaryExpr"; op: string; expr: Expr; }
export interface CallExpr { kind: "CallExpr"; callee: Expr; args: Expr[]; }
export interface AssignmentExpr { kind: "AssignmentExpr"; target: Expr; value: Expr; }
export interface NewExpr { kind: "NewExpr"; className: Identifier; args: Expr[]; }
export interface FieldAccessExpr { kind: "FieldAccessExpr"; obj: Expr; field: Identifier; }
export interface ThisExpr { kind: "ThisExpr"; }
export interface SuperExpr { kind: "SuperExpr"; method?: Identifier; }
