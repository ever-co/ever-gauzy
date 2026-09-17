/**
 * Metadata keys used for decorators and security features.
 */
export const PUBLIC_METHOD_METADATA = '__public:route__';
export const ROLES_METADATA = '__roles__';
export const PERMISSIONS_METADATA = '__permissions__';
export const FEATURE_METADATA = '__feature__';

/**
 * Marks a property that only a caller holding a given permission may read.
 *
 * The metadata is written per property rather than per class, because a resource declares several
 * gated fields and each carries its own permission. It is read on the way out of the API and on
 * the way into a write, so a value no caller may see is never serialized and a value no caller may
 * set is never persisted.
 */
export const VISIBLE_WITH_METADATA = '__visible:with__';
