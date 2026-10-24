/**
 * The channel a publication row names, a row it has no relation to (security audit P0 #6c).
 *
 * A product's, variant's or collection's publication row names its channel by `channelId`, a plain column: no relation
 * declares it, so the platform's cross-tenant check, which reads the relation join columns of a written row, never saw
 * it, and neither did the set writes, which insert through the manager. Every write of the three rows — `POST` / `PUT`
 * on `/product-channels`, `/product-variant-channels` and `/collection-channels`, `publish` / `unpublish`, the
 * `by-variant` and `by-collection` set writes and their GraphQL twins — stored another tenant's channel as given.
 *
 * The services hold the column to the caller's tenant with `assertPlainReferencesNotForeign` (`@gauzy/core`).
 */
import { PlainReferenceColumns } from '@gauzy/core';

/** The plain id column of a publication row. */
export const PUBLICATION_REFERENCES: PlainReferenceColumns = {
	channelId: 'channel'
};
