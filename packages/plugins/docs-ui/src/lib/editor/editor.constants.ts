/**
 * Editor-side constants that ride on the wire (spec 05 §9.1).
 *
 * Kept out of `lib/docs.constants.ts` on purpose: everything here is loaded with the tier-2
 * editor chunk behind the `page/:id` route, and the browse surface must not pull it in.
 */

/**
 * Version of the extension set a save was produced with, stamped as `metadata.schemaVersion`.
 *
 * 🛑 Spec 05 §9.1: "unknown node types throw on JSON load — never ship a schema change without
 * a loader shim". Every page saved before this constant existed is unversioned, so a shim can
 * only ever treat a missing value as "pre-1". **Bump this together with the migration entry**
 * whenever a node or mark type is removed or renamed.
 */
export const DOCS_EDITOR_SCHEMA_VERSION = 1;

/**
 * Ceiling for the CRDT snapshot sent as `contentBinary` (spec 05 §9.1 / §11).
 *
 * Mirrors the server's `GAUZY_DOCS_MAX_BINARY_BYTES` default (`docs.config.ts` →
 * `DEFAULT_DOCS_MAX_BINARY_BYTES`, 10 MB). Measured on the raw update **before** base64, which
 * is what the server sizes; a document over the cap simply saves without the binary rather
 * than failing the whole content save.
 */
export const DOCS_EDITOR_MAX_BINARY_BYTES = 10 * 1024 * 1024;
