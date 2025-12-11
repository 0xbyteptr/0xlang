# 0xlang - Simple Object-Oriented Language

A minimal, type-safe programming language that compiles to machine code via C.

## Quick Start

### Installation

```bash
npm install
npm run build
```

### Running Code

Interpret:
```bash
npm start examples/simple.0x
```

Compile to machine code:
```bash
npm run compile examples/simple.0x
```

## Language Syntax

### Variables

Variables use simple type annotations:

```
let x: int = 42
let name: String = "Alice"
let flag: bool = true
```

Semicolons are optional!

### Classes

Define classes with fields and methods:

```
class Person {
  name: String
  age: int
  
  constructor(name: String, age: int) {
    this.name = name
    this.age = age
  }
  
  greet(): String {
    return "Hello, I'm " + this.name
  }
}
```

### Inheritance

Classes can extend other classes:

```
class Employee extends Person {
  salary: int
  
  constructor(name: String, age: int, salary: int) {
    super(name, age)
    this.salary = salary
  }
}
```

### Creating Objects

Use `new` to create instances:

```
let person: Person = new Person("Bob", 30)
print(person.greet())
```

### Methods and Field Access

```
let x: int = person.age
person.name = "Charlie"
let msg: String = person.greet()
```

### Built-in Functions

Print output:

```
print(42)
print("Hello")
print(x + y)
```

### Expressions

Binary operations:
```
let sum: int = 10 + 20
let product: int = 5 * 4
let comparison: bool = x == y
```

Assignment (returns the assigned value):
```
let a: int = (x = 5)
this.value = 100
```

## Type System

Supported types:
- `int` - integers
- `String` - text strings  
- `bool` - booleans (true/false)
- Class types (custom classes)

## Compilation

0xlang compiles to optimized C code, then to native machine code:

```bash
npm run compile examples/program.0x
./program  # Run the compiled executable
```

Generated C code is kept for inspection and further optimization.

## Example Programs

### Hello World
```
print("Hello, World!")
```

### Counter
```
let count: int = 0
count = count + 1
count = count + 1
print(count)
```

### Class Example
```
class Dog {
  name: String
  
  constructor(name: String) {
    this.name = name
  }
  
  bark(): String {
    return this.name + " says woof!"
  }
}

let dog: Dog = new Dog("Rex")
print(dog.bark())
```

## Architecture

- **Lexer** (`src/lexer.ts`) - Tokenizes source code
- **Parser** (`src/parser.ts`) - Builds abstract syntax tree (AST)
- **Type Checker** (`src/typecheck.ts`) - Validates types
- **Code Generator** (`src/codegen.ts`) - Generates C code
- **Runtime** (`src/runtime.ts`) - Interprets AST for testing

## Project Structure

```
src/
  ast.ts          - AST type definitions
  lexer.ts        - Tokenization
  parser.ts       - Parsing to AST
  typecheck.ts    - Type checking
  codegen.ts      - C code generation
  runtime.ts      - Interpreter
  main.ts         - Entry point

examples/
  simple.0x       - Simple variable example
  test.0x         - Class example
  demo.0x         - Advanced example
```

## License

GPL-3.0
