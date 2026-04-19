# Review Checklist

## Function

- [ ] Matches requirements
- [ ] Edge cases handled
- [ ] Errors handled

## Code

- [ ] Clear naming
- [ ] No duplication
- [ ] No unnecessary comments
- [ ] Accurate types

## Performance

- [ ] No unnecessary re-renders
- [ ] No memory leaks
- [ ] Appropriate optimization

## Accessibility

- [ ] Semantic HTML (header, nav, main, section, footer)
- [ ] Skip navigation link
- [ ] focus-visible on interactive elements
- [ ] ARIA role/label
- [ ] img alt or aria-hidden
- [ ] WCAG AA contrast
- [ ] Keyboard-only navigable

## Assets

- [ ] WebP format (if images)
- [ ] ≤500KB per image (if images)
- [ ] dist/ ≤5MB (SPA)
- [ ] No unused assets

## CSS Visual Layers (no-image projects)

- [ ] ≥2 layers per section (e.g., ghost text + dot pattern)
- [ ] Techniques used:
  - `ghost text`: `opacity: 0.05`, `font-size: 8rem`, `font-weight: 900`, `z-index: 0`
  - `dot pattern`: `radial-gradient(circle, #000 1px, transparent 1px) 20px 20px`
  - `grid borders`: `border: 1px solid #1a1a1a`, `z-index: 10`
  - `glow`: `radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)`
- [ ] aria-hidden="true" on all decorative layers
- [ ] prefers-reduced-motion: `transition: none` or `animation: none` support
