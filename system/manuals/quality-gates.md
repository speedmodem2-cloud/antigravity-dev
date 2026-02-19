# Quality Gates

## G1: Code

- ESLint errors: 0
- TypeScript errors: 0
- No unused imports

## G2: Structure

- File <500 lines
- Function <50 lines
- Nesting <3 levels

## G3: Docs

- JSDoc on all exports
- README updated
- CHANGELOG updated

## G4: Security

- No hardcoded API keys
- .env in .gitignore
- No dependency vulnerabilities

## G5: Assets

**With images:** WebP, ≤500KB each, dist/ ≤5MB
**No images:** dist/ ≤1MB expected, CSS layers ≥2

## G6: Accessibility

- Semantic HTML
- Keyboard navigable
- ARIA attributes
- Color contrast AA
- Skip navigation
