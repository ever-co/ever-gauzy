import '../core/entities/internal';

import { MAX_PRODUCTS_PAGE_SIZE, ProductService } from './product.service';

/**
 * `GET /products/local/:langCode` (warehouse "Select product" dialog, MCP products tool) goes through
 * `findAllProducts`. It used to ignore its paging options and return the whole catalogue every time.
 */
describe('ProductService.findAllProducts paging', () => {
	const call = async (options?: { page?: unknown; limit?: unknown }) => {
		const self = {
			paginate: jest.fn().mockResolvedValue({ items: [{ id: 'p-1' }], total: 42 }),
			findAll: jest.fn().mockResolvedValue({ items: [{ id: 'p-1' }], total: 42 }),
			mapTranslatedProducts: jest.fn(async (items: unknown[]) => items)
		};
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const findAllProducts = ProductService.prototype.findAllProducts as any;
		const result = await findAllProducts.call(self, 'en', ['variants'], { organizationId: 'org-1' }, options);
		return { self, result };
	};

	it('returns the full list when no paging option is given', async () => {
		const { self, result } = await call();
		expect(self.findAll).toHaveBeenCalledWith({ relations: ['variants'], where: { organizationId: 'org-1' } });
		expect(self.paginate).not.toHaveBeenCalled();
		expect(result).toEqual({ items: [{ id: 'p-1' }], total: 42 });
	});

	it('paginates the requested page with a stable order', async () => {
		const { self } = await call({ page: '3', limit: '20' });
		expect(self.findAll).not.toHaveBeenCalled();
		expect(self.paginate).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { organizationId: 'org-1' },
				order: { createdAt: 'DESC', id: 'DESC' },
				skip: 3,
				take: 20
			})
		);
	});

	it.each([
		['an invalid page size', { page: '2', limit: 'abc' }, { skip: 2, take: 10 }],
		['an invalid page', { page: '-1', limit: '5' }, { skip: 1, take: 5 }],
		['only a page size', { limit: '15' }, { skip: 1, take: 15 }],
		['a page size above the cap', { page: '1', limit: '1000000' }, { skip: 1, take: MAX_PRODUCTS_PAGE_SIZE }]
	])('still paginates with defaults for %s', async (_label, options, expected) => {
		const { self } = await call(options);
		expect(self.findAll).not.toHaveBeenCalled();
		expect(self.paginate).toHaveBeenCalledWith(expect.objectContaining(expected));
	});
});
