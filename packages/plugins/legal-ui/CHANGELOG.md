# Changelog for @gauzy/plugin-legal-ui

## [Unreleased]

### Changed

- The Terms of Service, Privacy Policy and Cookie Policy are now served from the `@ever-co/legal`
  corpus, vendored into `src/lib/content/*.generated.ts` at authoring time and bundled with the
  build.

    Previously the three documents were fetched from a third-party REST API at runtime and injected
    with `[innerHtml]`. The only error handling was a `console.error`, so any failure — an outage, a
    blocked request, or a lapsed subscription — rendered the legal pages **blank**. Nothing is
    fetched any more, so that failure mode is gone.

- The page header now shows the document title, product, version and effective date, read from the
  corpus index.

### Added

- `LegalService.getDocument(document, locale?)` — synchronous lookup of a bundled legal document.
- `ILegalDocument` / `LegalDocumentSlug` models, and the `LEGAL_CORPUS` constants describing which
  corpus revision is bundled.
- `scripts/sync-legal-content.mjs` — regenerates the bundled text from a newer `@ever-co/legal`.
- Table styling for the corpus content (the previous provider never emitted tables).

### Removed

- The hard-coded third-party API endpoints `TERM_AND_POLICY_ENDPOINT`, `PRIVACY_POLICY_ENDPOINT`
  and `COOKIE_PRIVACY_POLICY_ENDPOINT`, and the runtime fetches that used them.

    `LegalService.getContentFromFromUrl()` is retained for callers that render a remotely hosted
    document; the in-app legal pages no longer call it.
