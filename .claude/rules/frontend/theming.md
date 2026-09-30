---
paths:
  - "app/assets/**"
  - "app/app.config.ts"
  - "app/layouts/**"
---

# Theming: three layers, in order

1. **Primitives** (`app/assets/css/tokens/color.css`, `palette.css`, `typography.css`, `layout.css`): `@theme static` blocks defining raw Tailwind 4 tokens, namely the custom `winner`/`loser`/`blue-ribbon` 50→950 ramps, font stacks, the projection type scale, and Nuxt UI role variables like `--ui-radius`.
2. **Theme values** (`light.css`, `dark.css`): only tokens that differ between themes, currently `--app-gradient`. `:root` and `.dark` have equal specificity, so **`dark.css` must remain the last import in `main.css`** or light wins.
3. **Semantic aliases** (`app/app.config.ts`): maps `primary`/`accent`/`winner`/… onto palettes, and holds Nuxt UI per-component defaults. Any new alias must also be listed in `ui.theme.colors` in `nuxt.config.ts` for Nuxt UI to generate its `--ui-<alias>` variables.

Use semantic classes (`text-muted`, `text-default`, `bg-(image:--app-gradient)`) over hardcoded colors.

## Known gaps

- `nuxt.config.ts` has a `fonts:` block, but `@nuxt/fonts` is neither a dependency nor a registered module. No `@font-face` rules are generated for the Lato files in `public/fonts/`, despite what the comment in `typography.css` claims. Lato currently only resolves if it is installed on the viewer's system.
