// src/main.ts
import { Parser } from "./parser";
import { TypeChecker } from "./typecheck";
import { Runtime } from "./runtime";
import { CodeGenerator } from "./codegen";
import * as AST from "./ast";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const args = process.argv.slice(2);
const mode = args[0] === "--compile" ? "compile" : "run";
const srcFile = args[args[0] === "--compile" ? 1 : 0] || "examples/demo.0x";
const outFile = args[args[0] === "--compile" ? 2 : 1];

const src = fs.readFileSync(srcFile, "utf8");

try {
  const p = new Parser(src);
  const prog = p.parseProgram();

  // Find all imports in the program
  const imports = prog.body.filter(s => s.kind === "ImportStmt") as AST.ImportStmt[];
  
  // Load imported modules
  const stdlibModules = ["math", "io", "string"];
  const importedModules = new Set<string>();
  
  // Always include math by default
  importedModules.add("math");
  
  for (const imp of imports) {
    if (stdlibModules.includes(imp.module)) {
      importedModules.add(imp.module);
    }
  }
  
  // Load all imported stdlib modules
  const stdlibBodies: AST.Stmt[] = [];
  for (const module of importedModules) {
    const stdlibPath = path.join(process.cwd(), "src", "std", `${module}.0x`);
    if (fs.existsSync(stdlibPath)) {
      const stdlibSrc = fs.readFileSync(stdlibPath, "utf8");
      const stdlibParser = new Parser(stdlibSrc);
      const stdlibProg = stdlibParser.parseProgram();
      stdlibBodies.push(...stdlibProg.body);
    }
  }
  
  // Prepend stdlib classes and imports to the program
  prog.body = [...stdlibBodies, ...prog.body];

  const tc = new TypeChecker();
  tc.check(prog);
  if (tc.errors.length) {
    console.error("Type errors:");
    for (const e of tc.errors) console.error(" - " + e);
    process.exit(1);
  }

  if (mode === "compile") {
    const gen = new CodeGenerator();
    const cCode = gen.generate(prog);
    const outC = outFile || path.basename(srcFile, ".0x") + ".c";
    const outExe = path.basename(outC, ".c");
    
    fs.writeFileSync(outC, cCode);
    console.log(`Generated ${outC}`);
    
    // Try to compile with available C compiler
    const compilers = ["gcc", "clang", "cl"];
    let compiled = false;
    
    for (const compiler of compilers) {
      try {
        const cmd = compiler === "cl" 
          ? `cl /Fe${outExe}.exe ${outC}`
          : `${compiler} -o ${outExe} ${outC}`;
        execSync(cmd, { stdio: "inherit" });
        console.log(`Compiled to ${outExe}${compiler === "cl" ? ".exe" : ""}`);
        compiled = true;
        break;
      } catch (e) {
        // Try next compiler
      }
    }
    
    if (!compiled) {
      console.error("No C compiler found. Install gcc, clang, or MSVC and try again.");
      console.error("C source code has been generated in " + outC);
      process.exit(1);
    }
  } else {
    const rt = new Runtime(prog);
    rt.run(prog);
  }
} catch (e) {
  if (e instanceof Error && e.name === 'CompileError') {
    console.error((e as any).format());
  } else {
    console.error(e);
  }
  process.exit(1);
}
