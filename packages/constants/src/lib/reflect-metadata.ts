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

/**
 * The list of gated properties a class declares, in declaration order.
 *
 * A property's own metadata says which permission it needs, but it cannot be *found* by asking the
 * class what it declares: an instance field lives on the instance, so the prototype carries no
 * property to enumerate — a projection that scanned prototype names would see only accessors and
 * miss every stored column. Each declaration therefore also appends itself to this class-level list,
 * which is what the projection and the write check read, once per class.
 */
export const VISIBLE_WITH_FIELDS_METADATA = '__visible:fields__';
