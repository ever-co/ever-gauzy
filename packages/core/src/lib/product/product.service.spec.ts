/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { NotFoundException } from '@nestjs/common';
import { ProductService } from './product.service';

/**
 * The product's own reads, at the service.
 *
 * One rule, and the suite walks it: the value the detail path carries names the row by identifier when
 * it is one and by slug otherwise, and the reading is the service's — one reading for both surfaces
 * rather than one per protocol. Two things the suite is careful about:
 *
 * - **the reads are the inherited, tenant-scoped ones.** The service states neither of them, so the
 *   caller's tenant and organization are merged into every criterion by the base class exactly as they
 *   were before the slug was accepted, which is what keeps the delivered scope on both forms;
 * - **only a miss is restated.** A value that matches no product is answered with the platform's own
 *   code whichever form it took, and a failure that is not a miss keeps its own class and message
 *   rather than being reported as a product that does not exist.
 *
 * The service under test is the real one over the two reads it inherits, spied on so the criterion
 * each form produces is asserted rather than inferred from a database.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const PRODUCT = '00000000-0000-4000-8000-000000000010';
const SLUG = 'a-widget';

/** The row the scripted reads answer with. */
const ROW = {
	id: PRODUCT,
	slug: SLUG,
	code: 'WIDGET-1',
	tenantId: TENANT,
	organizationId: ORGANIZATION,
	/** The translation merge the entity carries, so the per-language read answers as it does in service. */
	translateNested: (languageCode: string) => ({ ...ROW, languageCode })
};

/**
 * The service over the two reads it inherits, spied on so each form's criterion is readable.
 *
 * @returns The service, and the two reads as the calls it made to them.
 */
function surfaces() {
	const service = new ProductService({} as never, {} as never, {} as never);
	const byId = jest.spyOn(service, 'findOneByIdString').mockResolvedValue(ROW as never);
	const byOptions = jest.spyOn(service, 'findOneByOptions').mockResolvedValue(ROW as never);

	return { service, byId, byOptions };
}

describe('ProductService — the detail read answers for an identifier and for a slug', () => {
	it('reads a value that is an identifier by identifier, and never consults the slug column for it', async () => {
		const { service, byId, byOptions } = surfaces();

		expect(await service.findOneByIdOrSlug(PRODUCT, { relations: ['variants'], where: { enabled: true } })).toBe(
			ROW
		);
		expect(byId).toHaveBeenCalledWith(PRODUCT, { relations: ['variants'], where: { enabled: true } });
		// Control: the identifier branch is the read the route performed before the slug was accepted at
		// all. A read that narrowed on both columns would answer a product whose slug happened to equal
		// another row's identifier, which is a different product from the one that was asked for.
		expect(byOptions).not.toHaveBeenCalled();
	});

	it('reads any other value by slug, keeping the narrowing the caller stated', async () => {
		const { service, byId, byOptions } = surfaces();

		expect(await service.findOneByIdOrSlug(SLUG, { relations: ['variants'], where: { enabled: true } })).toBe(ROW);
		expect(byOptions).toHaveBeenCalledWith({
			relations: ['variants'],
			where: { enabled: true, slug: SLUG }
		});
		expect(byId).not.toHaveBeenCalled();
	});

	it('reads by slug when the caller states no further narrowing at all', async () => {
		const { service, byOptions } = surfaces();

		await service.findOneByIdOrSlug(SLUG);

		// The criterion names the slug and nothing else, so the caller's own filters are added to it
		// rather than replaced by it.
		expect(byOptions).toHaveBeenCalledWith({ where: { slug: SLUG } });
	});

	it('answers a value that matches no product with the platform’s own code, whichever form it took', async () => {
		const { service, byId, byOptions } = surfaces();
		byId.mockRejectedValueOnce(new NotFoundException('The requested record was not found'));
		byOptions.mockRejectedValueOnce(new NotFoundException('The requested record was not found'));

		const byIdentifier = await service.findOneByIdOrSlug(PRODUCT).catch((thrown) => thrown);

		expect(byIdentifier).toBeInstanceOf(NotFoundException);
		expect((byIdentifier as NotFoundException).getStatus()).toBe(404);
		expect((byIdentifier as Error).message).toMatch(/^RESOURCE_NOT_FOUND/);

		const bySlug = await service.findOneByIdOrSlug(SLUG).catch((thrown) => thrown);

		expect((bySlug as NotFoundException).getStatus()).toBe(404);
		expect((bySlug as Error).message).toMatch(/^RESOURCE_NOT_FOUND/);
		// The value is named, so a caller reading the refusal can tell which form it tried.
		expect((bySlug as Error).message).toContain(SLUG);
	});

	it('leaves a failure that is not a miss as the failure it was', async () => {
		const { service, byId } = surfaces();
		const failure = new Error('the connection was refused');
		byId.mockRejectedValueOnce(failure);

		// Control: only a miss is restated as the platform's code. Anything else — a driver failure, a
		// refused connection — keeps its own class and message rather than being reported as a product
		// that does not exist, which would send an operator down the wrong path entirely.
		await expect(service.findOneByIdOrSlug(PRODUCT)).rejects.toBe(failure);
	});

	it('reads the per-language sibling of the same value the same way', async () => {
		const { service, byOptions } = surfaces();

		// One row is read by two delivered reads, so a slug names it on both of them rather than only on
		// the route beside the per-language one.
		expect(await service.findByIdTranslated('de', SLUG)).toEqual(expect.objectContaining({ languageCode: 'de' }));
		expect(byOptions).toHaveBeenCalledWith({ where: { slug: SLUG }, relations: undefined });
	});

	it('reads through the tenant-scoped reads rather than a repository of its own', async () => {
		// Control: the two reads above are inherited from the tenant-aware base, which is where the
		// caller's tenant and organization are merged into every criterion. A read that reached a
		// repository directly would answer another tenant's row and would refuse nothing, so the service
		// declaring neither method of its own is what keeps the delivered scope on both forms.
		expect(Object.prototype.hasOwnProperty.call(ProductService.prototype, 'findOneByIdString')).toBe(false);
		expect(Object.prototype.hasOwnProperty.call(ProductService.prototype, 'findOneByOptions')).toBe(false);
		expect(typeof ProductService.prototype.findOneByIdOrSlug).toBe('function');
		expect(typeof ProductService.prototype.applyBulkItem).toBe('function');
	});
});
