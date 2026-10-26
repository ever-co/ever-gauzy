import { JsonData } from '@gauzy/contracts';

/**
 * Reads a `metadata` column as a plain object.
 *
 * The column is open-ended by design — a tenant puts whatever its tier or its integration needs in
 * it — so the type it is declared with admits a document of any shape, and merging a new key into one
 * therefore has to be told that what it is spreading is an object. A value that is not one (a
 * document that was written as an array or a scalar by an import, say) is replaced by an empty object
 * rather than spread, because spreading a scalar would silently produce a document with character
 * keys in it.
 *
 * @param metadata The stored value.
 * @returns The value as an object, empty when there is nothing usable to merge into.
 */
export function asMetadata(metadata: JsonData | undefined | null): Record<string, unknown> {
	if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
		return {};
	}

	return { ...(metadata as Record<string, unknown>) };
}
