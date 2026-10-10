/**
 * The domain events of this package.
 *
 * The promotion domain emits four facts other parts of the platform react to: a promotion changed
 * state, a budget ran out, a code was redeemed, and stored value was spent. Emitting them through the
 * platform event bus rather than through a direct call is what keeps a subscriber — a cache, a
 * notification, a webhook subscriber — from becoming a dependency of the service that made the
 * change.
 */
export * from './promotion.events';
