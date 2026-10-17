import '../core/entities/internal';

import { ProductService } from './product.service';

/**
 * Removing an image from a product's gallery is refused while a variant uses it. The check read
 * `variant.image.id`, which threw for a variant without an image, so the removal failed for every product
 * having one.
 */
describe('ProductService.deleteGalleryImage', () => {
	const gallery = [{ id: 'image-1' }, { id: 'image-2' }];

	const removeFrom = async (variants: unknown[], imageId: string) => {
		const service = new ProductService({} as never, {} as never, {} as never);
		jest.spyOn(service, 'findOneByIdString').mockResolvedValue({ id: 'product-1', gallery, variants } as never);
		const save = jest.spyOn(service, 'save').mockImplementation(async (product) => product as never);
		const result = await service.deleteGalleryImage('product-1', imageId);
		return { result, save };
	};

	afterEach(() => jest.restoreAllMocks());

	it('removes the image when a variant has no image', async () => {
		const { result } = await removeFrom([{ id: 'variant-1', image: null, imageId: null }], 'image-1');

		expect(result.gallery).toEqual([{ id: 'image-2' }]);
	});

	// The refusal itself, not any BadRequestException: the old check also ended in one, by throwing on
	// the missing `image`
	const refusedAsUsed = {
		response: expect.objectContaining({ message: 'Image is used in product variants' })
	};

	it('refuses to remove an image a variant uses (relation and id loaded)', async () => {
		await expect(
			removeFrom([{ id: 'variant-1', image: { id: 'image-1' }, imageId: 'image-1' }], 'image-1')
		).rejects.toMatchObject(refusedAsUsed);
	});

	it('refuses it when only the image id of the variant is loaded', async () => {
		await expect(removeFrom([{ id: 'variant-1', imageId: 'image-1' }], 'image-1')).rejects.toMatchObject(
			refusedAsUsed
		);
	});

	it('refuses it when only the image relation of the variant is loaded', async () => {
		await expect(removeFrom([{ id: 'variant-1', image: { id: 'image-1' } }], 'image-1')).rejects.toMatchObject(
			refusedAsUsed
		);
	});
});
