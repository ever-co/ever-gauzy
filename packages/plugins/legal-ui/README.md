# @gauzy/plugin-legal-ui

Renders the Terms of Service, Privacy Policy and Cookie Policy inside the Gauzy application.

Two mount points are provided, both backed by the same components:

| Route                                          | Module            | Layout                           |
| ---------------------------------------------- | ----------------- | -------------------------------- |
| `#/legal/terms`, `#/legal/privacy`             | `LegalModule`     | public, inside `NbAuthComponent` |
| `#/pages/legal/terms`, `#/pages/legal/privacy` | `PageLegalModule` | authenticated application shell  |

## Where the text comes from

The legal text is **bundled into the build**. It is vendored from the published
[`@ever-co/legal`](https://www.npmjs.com/package/@ever-co/legal) corpus (product `gauzy`, locale `en`)
into `src/lib/content/*.generated.ts` and committed to this repository.

That means rendering a legal page:

- makes **no HTTP request**, so the pages cannot go blank when a remote service is down;
- has **no third-party or subscription dependency**;
- ships text that is reviewable in the diff and pinned by the corpus `sha256`.

Each document also carries its `version` and `effectiveDate`, taken from the corpus `index.json`, and
both are shown in the page header.

`LegalService.getDocument()` is a synchronous lookup over those constants:

```ts
const terms = this.legalService.getDocument('tos');
terms.title; // 'Terms of Service'
terms.version; // '1.0.0'
terms.effectiveDate; // '2026-08-02'
terms.html; // rendered HTML body
```

## Refreshing the legal text

`@ever-co/legal` is deliberately **not** a dependency of this repository — neither the build nor the
runtime needs it, only the maintainer who refreshes the text. To pull in a newer corpus:

```bash
# fetches the published tarball into a temp folder and regenerates src/lib/content
node packages/plugins/legal-ui/scripts/sync-legal-content.mjs --fetch

# or point at a corpus you already have on disk
node packages/plugins/legal-ui/scripts/sync-legal-content.mjs --corpus /path/to/@ever-co/legal/dist
```

Then review the diff and commit the regenerated files. The script fails loudly if the corpus is
missing a document, marks one as not publishable, or disagrees with itself about a revision.

## Building

Run `yarn nx build plugin-legal-ui` to build the library.

## Running unit tests

Run `yarn nx test plugin-legal-ui` to execute the unit tests via [Jest](https://jestjs.io).

## Publishing

After building your library with `yarn nx build plugin-legal-ui`, go to the dist folder `dist/packages/plugins/legal-ui` and run `npm publish`.

## Installation

Install the Legal UI Plugin using your preferred package manager:

```bash
npm install @gauzy/plugin-legal-ui
# or
yarn add @gauzy/plugin-legal-ui
```
