# @gauzy/plugin-docs-ui

Angular UI plugin providing the **Documents hub** for the Gauzy platform: a
single tree of folders, authored wiki pages and uploaded files with processing
status, AI-knowledge state, review workflow, filters, uploads and bulk actions.

Backed by the `@gauzy/plugin-docs` API plugin (`/api/plugins/docs`). The
binding specifications live in the `specs/documents` suite
(`04-frontend-plugin.md` is the engineering contract for this package).

## Features (M1)

- `DocsUiPlugin: PluginUiDefinition` — top-level **Documents** nav section
  (before `focus`), route `/pages/documents` at `page-sections`,
  `DOCS` translation namespace, gated on `FEATURE_DOCUMENTS` + `DOCS_READ`.
- Shell layout: collapsible in-page tree column
  (`@ali-hm/angular-tree-component`, lazy children, drag & drop re-parent with
  client-side cycle check), content outlet and the `?id=` detail side panel.
- Browse page: server-paginated `angular2-smart-table` (custom cells for kind
  icon + name, status/knowledge/source badges, category/tag chips), preset
  chips with live facet counts, multi-select facets, date ranges,
  name-vs-content search toggle, full URL round-tripping (§6 contract).
- Upload: page-wide dropzone + hidden multi file input, classification dialog
  (categories/tags/AI-classify/add-to-knowledge), per-file progress rows and a
  self-stopping 5 s processing poll.
- Detail panel: metadata, AI summary, inline taxonomy editing, searchable and
  AI-knowledge toggles, review banner with approve/reject, extracted-text
  correction dialog, linked records, favorite star.
- Review queue (`/pages/documents/review`, `DOCS_REVIEW`) and the
  `DOCS_MANAGE` bulk bar (≤ 200 ids, per-id error report).
- `page/:id` — lazily loaded read-only PAGE viewer placeholder; the TipTap
  editor replaces it in the editor wave.

## Registration

```ts
// apps/gauzy/src/plugin-ui.config.ts
import { DocsUiPlugin } from '@gauzy/plugin-docs-ui';

export const uiPluginConfig = {
	plugins: [DocsUiPlugin]
};
```

Routes contributed by other plugins at the `'documents-sections'` page-route
location render inside the Documents shell automatically.

### Required global stylesheet — KaTeX

The editor renders mathematics with `@tiptap/extension-mathematics`, which draws
KaTeX markup into the ProseMirror DOM at runtime. Because that markup is created
by ProseMirror rather than by an Angular template it never carries a component's
`_ngcontent-*` attribute, so KaTeX **must** be loaded as a global stylesheet —
an inlined component style would be rewritten by view encapsulation and match
nothing. The host app adds it to its build `styles` (all browser targets):

```jsonc
// apps/gauzy/project.json — targets.{build,desktop-ui,server-ui}.options.styles
"styles": [
	/* … */
	"node_modules/katex/dist/katex.min.css"
]
```

Referencing the package's own stylesheet keeps its `url(fonts/…)` declarations
resolvable (they are relative to `node_modules/katex/dist`) so the bundler emits
the KaTeX web fonts automatically — no `assets` entry and no vendored copy.

## Building

```bash
yarn nx build plugin-docs-ui
```

## Testing

```bash
yarn nx test plugin-docs-ui
```
