/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { NotFoundException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PermissionsEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { BulkExecutor } from '../api/bulk-executor.service';
import { readBulkOperation } from '../api/bulk.decorator';
import { FieldVisibility } from '../api/field-visibility.service';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import { IDEMPOTENT_METADATA_KEY } from '../idempotency/idempotency.policy';
import { ProductController } from './product.controller';
import { IBulkProductItem, productBulkOptions } from './product.bulk';

/**
 * The catalogue's sellable thing over REST, at the two routes this wave delivers.
 *
 * The suite pins what a controller owes and a service cannot state for it:
 *
 * - **the detail read resolves the value it is given.** `GET /products/:idOrSlug` carries one value
 *   and hands it on as it stands — no UUID pipe decides for the resource which column a value names —
 *   so an identifier and a slug reach the same service method and a miss is the 404 the service
 *   raised, whichever form it took;
 * - **the batch is the platform's**, run by the real `BulkExecutor` over the route's own
 *   `@BulkOperation` declaration, so the resource, the cap, the permission and the members an item
 *   must carry are read from the declaration rather than restated in the route body;
 * - **atomic means atomic.** A batch that asks for it writes nothing when one item fails, and a batch
 *   that does not keeps what applied and reports the rest — which is the whole difference the flag
 *   exists to state;
 * - **the retry declaration is one scope**, so a retry of the batch replays the batch's answer rather
 *   than running it a second time.
 *
 * The controller under test is the real one over a scripted service and the platform's own executor,
 * and the writes it performs are recorded the way a database records them: a transaction that threw
 * leaves nothing behind.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const PRODUCT = '00000000-0000-4000-8000-000000000010';
const SLUG = 'a-widget';

/** The row a scripted service answers with. */
const APPLIED = { id: PRODUCT, code: 'WIDGET-1', slug: SLUG, enabled: true, tenantId: TENANT };

/**
 * The batch, as the route runs it.
 *
 * The service is scripted and the executor is the platform's own, so what is asserted below is the
 * route's half of the contract: that its declaration configures the executor, that it supplies the
 * transaction the service owns, that every item is handed the manager that transaction opened, and
 * that the executor's rollback is allowed to be the whole outcome of an atomic batch.
 *
 * @param options The grants the field-visibility double answers, and any service member to override.
 * @returns The controller, the scripted service, and what the batch wrote and committed.
 */
function surfaces(options: { granted?: PermissionsEnum[]; overrides?: Record<string, unknown> } = {}) {
	const granted = options.granted ?? [PermissionsEnum.PRODUCTS_BULK_IMPORT];
	const writes: string[] = [];
	const commits: string[][] = [];
	const managers: unknown[] = [];
	const manager = { connection: 'the batch transaction' };

	const productService = {
		findOneByIdOrSlug: jest.fn().mockResolvedValue(APPLIED),
		applyBulkItem: jest.fn(async (item: IBulkProductItem, received?: unknown) => {
			managers.push(received);

			if (item.code === 'GADGET-2') {
				throw new ApiException(409, ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION, 'The code is taken.', {
					field: 'code'
				});
			}

			writes.push(String(item.code));

			return { ...APPLIED, id: `product-${item.code}` };
		}),
		transaction: jest.fn(async (work: (transactional: unknown) => Promise<unknown>) => {
			const before = [...writes];

			try {
				const result = await work(manager);

				commits.push([...writes]);

				return result;
			} catch (error) {
				writes.splice(0, writes.length, ...before);

				throw error;
			}
		}),
		...(options.overrides ?? {})
	};
	const commandBus = { execute: jest.fn() };
	// The executor authorises the whole request through the platform's field visibility, so the double
	// answers a permission exactly as that service does: a caller who does not hold it is refused.
	const visibility = {
		assertCanSee: jest.fn((permission: PermissionsEnum) => {
			if (!granted.includes(permission)) {
				throw new ApiException(403, ApiErrorCode.PERMISSION_DENIED, 'Denied.', { permission });
			}
		}),
		canSee: jest.fn().mockReturnValue(granted.length > 0)
	} as unknown as FieldVisibility;

	return {
		writes,
		commits,
		managers,
		manager,
		productService,
		visibility,
		controller: new ProductController(
			productService as never,
			commandBus as never,
			new BulkExecutor(visibility)
		)
	};
}

/** The route one handler declares, as Nest's own metadata states it. */
function routeOf(handler: string): { path: string; method: RequestMethod } {
	const prototype = ProductController.prototype as unknown as Record<string, object>;

	return {
		path: Reflect.getMetadata(PATH_METADATA, prototype[handler]),
		method: Reflect.getMetadata(METHOD_METADATA, prototype[handler])
	};
}

describe('ProductController — the detail read resolves an identifier or a slug', () => {
	it('passes the value the path carries to the service, and lets the resource read it', async () => {
		const { controller, productService } = surfaces();

		expect(await controller.findById(PRODUCT, { relations: ['variants'], findInput: { enabled: true } })).toBe(
			APPLIED
		);
		expect(productService.findOneByIdOrSlug).toHaveBeenLastCalledWith(PRODUCT, {
			relations: ['variants'],
			where: { enabled: true }
		});

		// Control: the route carries no UUID pipe any more, so a slug reaches the service as it stands
		// instead of being refused as a malformed identifier before the resource ever sees it — and the
		// value the service receives is the one the caller put in the path, unchanged.
		expect(await controller.findById(SLUG, {})).toBe(APPLIED);
		expect(productService.findOneByIdOrSlug).toHaveBeenLastCalledWith(SLUG, { relations: [], where: null });
	});

	it('keeps the caller’s narrowing as the whole of what the route adds', async () => {
		// The tenant and organization scope is the service's, so what this route states is the caller's
		// own narrowing and nothing else: a route that dropped it would widen the read silently.
		const { controller, productService } = surfaces();

		await controller.findById(SLUG, {
			relations: ['gallery'],
			findInput: { organizationId: ORGANIZATION }
		});

		expect(productService.findOneByIdOrSlug).toHaveBeenCalledWith(SLUG, {
			relations: ['gallery'],
			where: { organizationId: ORGANIZATION }
		});
	});

	it('answers a value that matches no product with the 404 the service raised', async () => {
		const { controller, productService } = surfaces();
		productService.findOneByIdOrSlug.mockRejectedValueOnce(
			new NotFoundException('RESOURCE_NOT_FOUND: no product matches.')
		);

		const bySlug = await controller.findById('a-gadget', {}).catch((thrown) => thrown);

		expect(bySlug).toBeInstanceOf(NotFoundException);
		expect((bySlug as Error).message).toContain('RESOURCE_NOT_FOUND');
	});
});

describe('ProductController — the batch applies what it can, or nothing at all', () => {
	it('applies a batch that is not atomic item by item, and reports the failures beside the successes', async () => {
		const { controller, writes } = surfaces();

		const result = await controller.bulk({
			items: [
				{ op: 'create', code: 'WIDGET-1' },
				{ op: 'create', code: 'GADGET-2' }
			]
		});

		expect(result.total).toBe(2);
		expect(result.succeededCount).toBe(1);
		expect(result.failedCount).toBe(1);
		expect(result.succeededCount + result.failedCount).toBe(result.total);
		expect(result.failed[0]).toMatchObject({
			index: 1,
			code: ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION,
			details: { field: 'code' }
		});
		// Control: the item that applied stands. A batch without the flag is a sequence of writes, and
		// the item that was refused does not undo the one before it — which is what distinguishes it
		// from the atomic case below.
		expect(writes).toEqual(['WIDGET-1']);
	});

	it('writes nothing when one item of an atomic batch fails, and names the item that failed', async () => {
		const { controller, writes, commits } = surfaces();

		const refusal = await controller
			.bulk({
				atomic: true,
				items: [
					{ op: 'create', code: 'WIDGET-1' },
					{ op: 'create', code: 'GADGET-2' }
				]
			})
			.catch((thrown) => thrown);

		// The failure is the failing item's own code, which is what the caller branches on, and the
		// complete per-item report travels beside it.
		expect(refusal).toBeInstanceOf(ApiException);
		expect((refusal as ApiException).code).toBe(ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION);
		expect((refusal as ApiException).getStatus()).toBe(409);
		expect((refusal as ApiException).details).toMatchObject({ failedCount: 1, total: 2 });
		expect(((refusal as ApiException).details.items as Array<Record<string, unknown>>)[0]).toMatchObject({
			index: 1
		});
		// Nothing is committed and nothing survives the rollback: that is the whole of what the flag asks.
		expect(commits).toHaveLength(0);
		expect(writes).toEqual([]);
	});

	it('runs an atomic batch inside the service’s own transaction, and hands every item its manager', async () => {
		const { controller, productService, manager, managers, commits } = surfaces();

		const result = await controller.bulk({
			atomic: true,
			items: [
				{ op: 'create', code: 'WIDGET-1' },
				{ op: 'create', code: 'GADGET-1' }
			]
		});

		expect(result.succeededCount).toBe(2);
		// Control: the executor refuses an atomic batch the route supplied no transaction for, so this
		// asserts the route handed it the service's runner rather than none — and that every item was
		// given the manager that runner opened, which is what makes an item's write part of the batch.
		expect(productService.transaction).toHaveBeenCalledTimes(1);
		expect(managers).toEqual([manager, manager]);
		expect(commits).toHaveLength(1);
	});

	it('authorises the whole batch once, before the first item, with the catalogue’s bulk permission', async () => {
		const { controller, productService, visibility } = surfaces({ granted: [] });

		const refusal = await controller.bulk({ items: [{ op: 'create', code: 'WIDGET-1' }] }).catch((thrown) => thrown);

		expect((refusal as ApiException).code).toBe(ApiErrorCode.PERMISSION_DENIED);
		expect((refusal as ApiException).getStatus()).toBe(403);
		expect(productService.applyBulkItem).not.toHaveBeenCalled();
		// One decision for the request: an eight-item batch is not eight authorisation answers.
		expect(visibility.assertCanSee).toHaveBeenCalledTimes(1);
		expect(visibility.assertCanSee).toHaveBeenCalledWith(PermissionsEnum.PRODUCTS_BULK_IMPORT, {
			resource: 'product',
			mode: 'write'
		});
	});

	it('refuses an item that does not name its operation rather than applying the batch without it', async () => {
		const { controller, productService } = surfaces();

		const refusal = await controller.bulk({ items: [{ code: 'WIDGET-1' } as never] }).catch((thrown) => thrown);

		expect((refusal as ApiException).code).toBe(ApiErrorCode.BULK_ALL_ITEMS_FAILED);
		expect((refusal as ApiException).details).toMatchObject({
			items: [
				{
					index: 0,
					code: ApiErrorCode.VALIDATION_REQUIRED_FIELD,
					details: { field: 'op' }
				}
			]
		});
		expect(productService.applyBulkItem).not.toHaveBeenCalled();
	});

	it('requires an item that changes or archives a row to name it', async () => {
		const { controller, productService } = surfaces();

		const refusal = await controller.bulk({ items: [{ op: 'delete' } as never] }).catch((thrown) => thrown);

		expect((refusal as ApiException).details).toMatchObject({
			items: [
				{
					index: 0,
					code: ApiErrorCode.VALIDATION_REQUIRED_FIELD,
					details: { field: 'id' }
				}
			]
		});
		expect(productService.applyBulkItem).not.toHaveBeenCalled();
	});
});

describe('ProductController — the route declarations the executor and the kernel read', () => {
	it('declares the detail read as one path value and the batch as a POST on its own path', () => {
		expect(routeOf('findById')).toEqual({ path: ':idOrSlug', method: RequestMethod.GET });
		expect(routeOf('bulk')).toEqual({ path: '/bulk', method: RequestMethod.POST });
	});

	it('declares the batch the executor is configured from: the resource, the cap and the permission', () => {
		expect(readBulkOperation(ProductController.prototype.bulk)).toEqual({
			resource: 'product',
			maxItems: 200,
			permission: PermissionsEnum.PRODUCTS_BULK_IMPORT
		});
		// Control: the reader refuses a route that declares no batch at all, so this is the one
		// declaration both surfaces run the batch from rather than a second copy written into a route
		// body — and it is read off the route's own metadata, not restated here.
		expect(productBulkOptions(ProductController, 'bulk')).toEqual({
			resource: 'product',
			cap: 200,
			permission: PermissionsEnum.PRODUCTS_BULK_IMPORT
		});
		expect(() => productBulkOptions(ProductController, 'findById')).toThrow(/declares no @BulkOperation/);
	});

	it('declares the retry scope the platform stores keys under, and does not demand a key', () => {
		// A batch is safe to retry under a key and is not refused without one, which is what the
		// endpoint table states: the route honours a key and does not require it.
		expect(Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, ProductController.prototype.bulk)).toEqual({
			scope: 'product.bulk',
			required: false,
			resourceType: 'product'
		});
	});

	it('carries the bulk-import permission the catalogue declares, and no other', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ProductController.prototype.bulk)).toEqual([
			PermissionsEnum.PRODUCTS_BULK_IMPORT
		]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ProductController.prototype.findById)).toEqual([
			PermissionsEnum.ORG_INVENTORY_VIEW
		]);
	});
});
