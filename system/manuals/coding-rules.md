# Coding Rules

## Required

- Read file before edit
- One file at a time
- Lint after edit
- TypeScript for new files (.ts/.tsx)
- Explicit return types on all functions
- No magic numbers → constants file

## Forbidden

- `any` type
- `var`
- `==` (use `===`)
- `console.log` in production
- Uncommented complex logic
- Single file >500 lines

## Code Order

1. Types/interfaces
2. Constants
3. Utils
4. Main logic
5. Exports

## Error Handling

- Specific error types in try-catch
- User-facing messages: Korean

## Image Rules

- WebP preferred (PNG/JPG originals only)
- Max 500KB per image
- Background: object-fit: cover + overlay
- Vite static asset handling
- Originals: shared/assets/ → Project: src/assets/images/
