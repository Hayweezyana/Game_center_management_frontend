/**
 * Plain (non-module) stylesheet imports.
 *
 * create-react-app's own types (react-scripts/lib/react-app.d.ts) declare
 * `*.module.css` but never plain `*.css`. Editors running TypeScript 5.x check
 * side-effect imports and so report TS2882 ("Cannot find module or type
 * declarations for side-effect import") on every `import './Thing.css'`, while
 * the project's pinned compiler (TypeScript 4.9, moduleResolution "node")
 * skips that check entirely — which is why the editor and `tsc` disagreed.
 *
 * Declaring the pattern satisfies both. The more specific `*.module.css`
 * declaration in react-app.d.ts still wins for CSS-module imports, so those
 * keep their typed default export.
 */
declare module '*.css';
