/**
 * The gallery fields do what their inputs and their names say (review sweep R2-G4).
 *
 * `attachProductVariantMedia` declared a `position` on each item and ordered the gallery by the list alone, and
 * `reorderProductVariantMedia` — "without changing its membership" — wrote through the set write, so a list that
 * named a new image attached it and one that left an image out deleted it.
 */
import { galleryOrder, ProductVariantMediaResolver } from './product-variant-media.resolver';

const VARIANT = '00000000-0000-4000-8000-000000000201';

/** The resolver over a stub service holding a gallery of A (primary), B and C. */
function resolverWith(gallery = ['A', 'B', 'C']) {
	const service = {
		findByVariant: jest
			.fn()
			.mockResolvedValue(
				gallery.map((imageAssetId, position) => ({ imageAssetId, position, isPrimary: position === 0 }))
			),
		replaceMedia: jest.fn(async (_variantId: string, ids: string[]) =>
			ids.map((imageAssetId) => ({ imageAssetId }))
		),
		reorderMedia: jest.fn(async (_variantId: string, ids: string[]) =>
			ids.map((imageAssetId) => ({ imageAssetId }))
		)
	};

	return { service, resolver: new ProductVariantMediaResolver(service as never) };
}

describe('ProductVariantMediaResolver — gallery order and membership (R2-G4)', () => {
	it('orders an attached gallery by the position each item states, else by its place in the list', async () => {
		const { resolver, service } = resolverWith();

		await resolver.attachProductVariantMedia(VARIANT, [
			{ imageAssetId: 'A', position: 2 },
			{ imageAssetId: 'B', position: 0, isPrimary: true },
			{ imageAssetId: 'C', position: 1 }
		]);

		expect(service.replaceMedia).toHaveBeenCalledWith(VARIANT, ['B', 'C', 'A'], 'B');
	});

	it('keeps the list order when no position is stated, and between items that tie', () => {
		expect(galleryOrder([{ id: 'x' }, { id: 'y' }, { id: 'z' }] as any[]).map((it) => it.id)).toEqual([
			'x',
			'y',
			'z'
		]);
		expect(
			galleryOrder([
				{ id: 'x', position: 1 },
				{ id: 'y', position: 1 },
				{ id: 'z', position: 0 }
			] as any[]).map((it) => it.id)
		).toEqual(['z', 'x', 'y']);
	});

	it('reorders through the service’s own reorder, never through the set write that adds and removes', async () => {
		const { resolver, service } = resolverWith();

		await resolver.reorderProductVariantMedia(VARIANT, ['C', 'A', 'B']);

		expect(service.reorderMedia).toHaveBeenCalledWith(VARIANT, ['C', 'A', 'B']);
		expect(service.replaceMedia).not.toHaveBeenCalled();
	});
});
