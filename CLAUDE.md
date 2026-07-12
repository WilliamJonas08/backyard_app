# CLAUDE.md

## Mission
Act as a pragmatic software engineer for this repository.
Prefer small, readable, low-risk changes that a junior developer can understand, review, and maintain.

## Core working rules

### 1) Optimize for clarity first
- Always produce simple code.
- Be concise, but never at the cost of readability.
- Prefer straightforward solutions over clever or compressed implementations.
- Write code that a junior developer can confidently modify.

### 2) Separate responsibilities clearly
- Split code by responsibility, not by convenience.
- Keep business logic, I/O, formatting, validation, orchestration, and persistence separated.
- Prefer small modules and focused functions/classes with a single clear purpose.
- When a file starts handling multiple concerns, refactor it into smaller units.

### 3) Use patterns only when they make the code clearer
- Use established design patterns such as Strategy, Factory, Decorator or Template Method when they genuinely simplify the design, reduce branching, or make future changes safer.
- Do not force patterns into simple code.
- Prefer the lightest abstraction that makes the intent obvious.
- Avoid speculative abstractions for hypothetical future needs.

### 4) Use explicit, descriptive names
- Use variable, function, class, and file names that describe intent clearly.
- Prefer longer and explicit names over short and cryptic ones.
- Avoid single-letter variable names, except for well-known trivial cases such as very small mathematical expressions or obvious loop indices in tiny local scopes.
- Names should reveal role, unit, and meaning whenever possible.

### 5) Keep control flow explicit
- Do not use `continue` or `break`.
- Prefer explicit conditions, guard clauses, helper functions, or well-structured nested logic.
- Make the execution path easy to follow from top to bottom.
- Avoid hidden exits and surprising branching.
- Avoid __post_init__ methods and prefer clean and clear build_from methods

## Architecture and design guidance
- Follow the existing project structure and conventions before introducing new structure.
- Keep interfaces small and stable.
- Prefer composition over inheritance unless inheritance is clearly simpler.
- Minimize side effects and shared mutable state.
- Keep data transformations deterministic when possible.
- Isolate framework-specific code from domain logic.

## Refactoring guidance
- Refactor opportunistically when it improves clarity in the touched area.
- Remove duplication, but do not create abstractions too early.
- If a conditional tree grows or varies by context, consider Strategy or Factory.
- If behavior is extended around a stable core, consider Decorator.
- If object creation becomes repetitive or conditional, consider Factory.
- Explain in a few words why a pattern is used when it is not obvious.

## Change management
- Prefer the smallest diff that fully solves the problem.
- Preserve backward compatibility unless the task explicitly asks for a breaking change.
- Do not rename public symbols, move files, or reorganize folders without a good reason.
- Do not introduce new dependencies unless necessary and justified.
- Reuse existing utilities before creating new ones.

## Documentation and delivery
- Briefly explain what changed, why it changed, and any important trade-offs.
- When relevant, mention follow-up refactors separately from the main fix.
- Keep comments rare and useful.
- Prefer self-explanatory code over explanatory comments.

## Coding style defaults
- Favor early returns when they simplify readability.
- Keep functions short and focused.
- Avoid deeply coupled code.
- Avoid magic numbers; name meaningful constants.
- Prefer explicit types and contracts when the language supports them and they improve clarity.
- Keep error handling explicit and actionable.

## Planning rule for larger work
For complex features, wide refactors, or changes touching multiple modules:
- first write a short implementation plan,
- then execute in small steps,
- then summarize the result and remaining risks.


## Final checklist
Before finishing, make sure the solution is:
- simple,
- explicit,
- well-named,
- separated by responsibility,
- minimally invasive,
- validated,
- easy for a junior developer to maintain.
- introduces less code as possible 
