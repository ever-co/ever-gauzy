/**
 * Coordination between the image asset's load hook, which resolves an asset's `fullUrl` / `thumbUrl`, and the
 * load hooks of the entities that carry an image (user, organization, tenant, team, project, contact, product
 * category, issue type), which copy `image.fullUrl` into their own `imageUrl` / `logo` / `fullIconUrl`.
 *
 * Those hooks used to wait for the URL with an unconditional `setTimeout` — "simulate an async operation" — for
 * EVERY loaded row, image or not (an eager relation that matched nothing is still an own property, set to null).
 * A timer can only fire in the event loop's timers phase, at least 1 ms later and after whatever else is queued,
 * and TypeORM releases the query's pooled connection only once every load hook has settled: so every query of
 * these entities — the JWT strategy's lookup of the caller on EVERY authenticated request among them — held its
 * connection for an extra timer hop, longer the busier the process.
 *
 * Now the image's hook publishes the promise of its URLs on the asset itself, and the owner's hook awaits exactly
 * that promise, or nothing at all when there is no image. TypeORM broadcasts a relation's load events before the
 * owning entity's (Broadcaster.broadcastLoadEvent recurses into relations first), so the promise is there when
 * the owner looks for it; for any other order (MikroORM, a hand-built object) the previous timer hop remains the
 * fallback, so the copied URL can never be missed.
 */
const URLS_READY = Symbol.for('gauzy.imageAsset.urlsReady');

/**
 * Record that `asset`'s URLs are being resolved by `ready`. The property is a non-enumerable symbol, so it is never
 * serialized (JSON.stringify and class-transformer skip it) and never persisted.
 */
export function publishImageAssetUrls(asset: object, ready: Promise<unknown>): void {
	Object.defineProperty(asset, URLS_READY, { value: ready, enumerable: false, configurable: true, writable: true });
}

/**
 * What an owner's load hook must await before reading the URLs of `asset` (its image, logo or icon relation):
 *
 * - nothing (`undefined`) when there is no asset, or when its URLs are already set;
 * - the asset's own URL resolution when its load hook has started it;
 * - otherwise one timer hop, the previous behaviour.
 */
export function imageAssetUrlsReady(asset: unknown): Promise<unknown> | undefined {
	if (!asset || typeof asset !== 'object') {
		return undefined;
	}
	const ready = (asset as Record<symbol, Promise<unknown> | undefined>)[URLS_READY];
	if (ready) {
		return ready;
	}
	if ((asset as { fullUrl?: unknown }).fullUrl !== undefined) {
		return undefined;
	}
	return new Promise((resolve) => setTimeout(resolve));
}
