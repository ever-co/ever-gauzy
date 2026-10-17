/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PermissionsEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { BulkExecutor } from '../api/bulk-executor.service';
import { readBulkOperation } from '../api/bulk.decorator';
import { FieldVisibility } from '../api/field-visibility.service';
import { RequestContext } from '../core/context';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import { IDEMPOTENT_METADATA_KEY } from '../idempotency/idempotency.policy';
import { CreateTagDTO } from './dto';
import { TagController } from './tag.controller';
import { TagResolver } from './tag.resolver';

/**
 * `POST /tags/bulk` and `bulkCreateTags`: many tags in one request, each filed exactly as `POST /tags`
 * files one.
 *
 * The batch is the platform's — the real `BulkExecutor`, configured from the route's own `@BulkOperation`
 * — and the item is the single create's: its body runs through the create route's own validation pipe and
 * then through the same service method. So what is pinned here is that a batch creates what N single
 * calls would, refuses an item for the reason that item would be refused alone and applies the rest,
 * refuses an atomic batch before writing anything (each item is the single create: there is no batch
 * transaction to roll back), enforces its cap, stays inside the caller's tenant, and is authorised exactly
 * as the single create is.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const OTHER_TENANT = '00000000-0000-4000-8000-000000000099';

/** The grants of the caller, as the platform's field visibility reads them. */
function visibilityFor(granted: PermissionsEnum[]): FieldVisibility {
	return {
		canSee: (permission: PermissionsEnum) => granted.includes(permission),
		assertCanSee: (permission: PermissionsEnum) => {
			if (!granted.includes(permission)) {
				throw new ApiException(403, ApiErrorCode.PERMISSION_DENIED, 'Denied.', { permission });
			}
		},
		denialFor: (permission: PermissionsEnum) => ({
			code: ApiErrorCode.PERMISSION_DENIED,
			status: 403,
			details: { requiredPermission: permission },
			message: 'This caller may not write the requested field.'
		})
	} as unknown as FieldVisibility;
}

/** Both surfaces over a scripted service whose writes are recorded. */
function surfaces(options: { granted?: PermissionsEnum[] } = {}) {
	const writes: string[] = [];
	const tagService = {
		create: jest.fn(async (body: Record<string, unknown>) => {
			if (body.name === 'Taken') {
				// The refusal the service raises for a row it will not write, whichever surface asked.
				throw new ApiException(409, ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION, 'A tag with this name exists.', {
					field: 'name'
				});
			}
			writes.push(String(body.name));

			return { id: `tag-${String(body.name)}`, ...body };
		})
	};
	const executor = new BulkExecutor(visibilityFor(options.granted ?? [PermissionsEnum.ORG_TAGS_ADD]));
	const commandBus = { execute: jest.fn() };

	return {
		writes,
		tagService,
		controller: new TagController(tagService as never, commandBus as never, executor),
		resolver: new TagResolver(tagService as never, commandBus as never, executor)
	};
}

beforeEach(() => {
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
});

afterEach(() => jest.restoreAllMocks());

describe('POST /tags/bulk — each item is POST /tags', () => {
	it('files what the same items filed one by one would: the create route’s own validation, then its service', async () => {
		const { controller, tagService } = surfaces();
		const items = [
			{ name: 'Bug', color: '#e11d48', isSystem: true },
			{ name: 'Feature', color: '#0ea5e9', description: 'Something new' }
		];

		const result = await controller.bulk({ items });

		// What `POST /tags` hands its service for each body: the route's whitelist pipe drops `isSystem`, a
		// member the create route never accepted.
		const pipe = new ValidationPipe({ whitelist: true });
		const single = await Promise.all(
			items.map((item) => pipe.transform(item, { type: 'body', metatype: CreateTagDTO }))
		);

		expect(tagService.create.mock.calls.map(([body]) => body)).toEqual(single);
		expect(tagService.create.mock.calls[0][0]).not.toHaveProperty('isSystem');
		expect(result).toMatchObject({ total: 2, succeededCount: 2, failedCount: 0 });
		expect(result.succeeded).toEqual([
			{ index: 0, id: 'tag-Bug', resource: 'tag' },
			{ index: 1, id: 'tag-Feature', resource: 'tag' }
		]);
	});

	it('reports a refused item with the create route’s reason and files the rest', async () => {
		const { controller, writes } = surfaces();

		const result = await controller.bulk({
			items: [
				{ name: 'Bug', color: '#e11d48' },
				{ color: '#0ea5e9' } as never,
				{ name: 'Chore', color: '#a3a3a3' }
			]
		});

		expect(result.succeededCount).toBe(2);
		expect(result.failed).toEqual([
			expect.objectContaining({
				index: 1,
				code: ApiErrorCode.VALIDATION_FAILED,
				details: { messages: expect.arrayContaining(['name should not be empty']) }
			})
		]);
		expect(writes).toEqual(['Bug', 'Chore']);
	});

	it('refuses an atomic batch before writing anything', async () => {
		const { controller, writes, tagService } = surfaces();

		const refusal = await controller
			.bulk({
				atomic: true,
				items: [
					{ name: 'Bug', color: '#e11d48' },
					{ name: 'Chore', color: '#a3a3a3' }
				]
			})
			.catch((thrown) => thrown);

		// Each item is the single create, which writes through its own repositories: no transaction could
		// roll a batch back as one, so the route says so instead of answering as though it were atomic.
		expect(refusal).toBeInstanceOf(ApiException);
		expect((refusal as ApiException).getStatus()).toBe(400);
		expect((refusal as ApiException).code).toBe(ApiErrorCode.BULK_ATOMIC_UNSUPPORTED);
		expect((refusal as ApiException).details).toEqual({ field: 'atomic', resource: 'tag' });
		expect(tagService.create).not.toHaveBeenCalled();
		expect(writes).toEqual([]);
	});

	it('refuses an item naming another tenant exactly as the create route does, and files none of it there', async () => {
		const { controller, tagService } = surfaces();

		const result = await controller.bulk({
			items: [
				{ name: 'Mine', color: '#e11d48', tenantId: TENANT },
				{ name: 'Theirs', color: '#0ea5e9', tenantId: OTHER_TENANT }
			]
		});

		expect(result.succeeded.map((entry) => entry.index)).toEqual([0]);
		expect(result.failed[0]).toMatchObject({ index: 1, code: ApiErrorCode.VALIDATION_FAILED });
		expect(result.failed[0].message).toContain('not associated with the requested tenant');
		expect(tagService.create.mock.calls.map(([body]) => body.tenantId)).toEqual([TENANT]);
	});

	it('refuses a batch above its cap before filing anything', async () => {
		const { controller, tagService } = surfaces();
		const items = Array.from({ length: 201 }, (_unused, index) => ({ name: `tag-${index}`, color: '#000000' }));

		const refusal = await controller.bulk({ items }).catch((thrown) => thrown);

		expect((refusal as ApiException).getStatus()).toBe(413);
		expect((refusal as ApiException).code).toBe(ApiErrorCode.BULK_LIMIT_EXCEEDED);
		expect((refusal as ApiException).details).toEqual({ limit: 200, actual: 201 });
		expect(tagService.create).not.toHaveBeenCalled();
	});

	it('refuses a caller holding neither grant of the create route before the first item', async () => {
		const { controller, tagService } = surfaces({ granted: [PermissionsEnum.ORG_TAGS_EDIT] });

		const refusal = await controller.bulk({ items: [{ name: 'Bug', color: '#e11d48' }] }).catch((thrown) => thrown);

		expect((refusal as ApiException).code).toBe(ApiErrorCode.PERMISSION_DENIED);
		expect(tagService.create).not.toHaveBeenCalled();
	});

	it('admits a caller holding only the create route’s other grant, as the create route does', async () => {
		const { controller } = surfaces({ granted: [PermissionsEnum.ALL_ORG_EDIT] });

		const result = await controller.bulk({ items: [{ name: 'Bug', color: '#e11d48' }] });

		expect(result.succeededCount).toBe(1);
	});

	it('refuses a dry run and any operation but create, which this route does not offer', async () => {
		const { controller, tagService } = surfaces();

		const dryRun = await controller
			.bulk({ dryRun: true, items: [{ name: 'Bug', color: '#e11d48' }] } as never)
			.catch((thrown) => thrown);
		const update = await controller
			.bulk({ items: [{ op: 'update', id: 'tag-1', name: 'Bug' } as never] })
			.catch((thrown) => thrown);

		expect((dryRun as ApiException).details).toEqual({ field: 'dryRun' });
		expect((update as ApiException).details).toMatchObject({
			items: [
				{ index: 0, code: ApiErrorCode.VALIDATION_INVALID_ENUM, details: { field: 'op', allowed: ['create'] } }
			]
		});
		expect(tagService.create).not.toHaveBeenCalled();
	});
});

describe('bulkCreateTags — the same batch over GraphQL, each item `createTag`', () => {
	it('files each item exactly as `createTag` files one, and answers one outcome per item', async () => {
		const { resolver, tagService } = surfaces();
		const items = [
			{ name: 'Bug', color: '#e11d48' },
			{ name: 'Taken', color: '#0ea5e9' }
		];

		const payload = await resolver.bulkCreateTags({ items });

		// The service is handed what `createTag` hands it for the same input.
		expect(tagService.create.mock.calls.map(([body]) => body)).toEqual(items);
		expect(payload).toMatchObject({ succeeded: 1, failed: 1, total: 2 });
		expect(payload.results[0]).toMatchObject({ index: 0, ok: true, id: 'tag-Bug', resource: 'tag' });
		expect(payload.results[1]).toMatchObject({
			index: 1,
			ok: false,
			error: { code: ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION, path: ['items', '1'], details: { field: 'name' } }
		});
	});

	it('refuses an atomic batch before writing anything, exactly as the route does', async () => {
		const { resolver, writes, tagService } = surfaces();

		const refusal = await resolver
			.bulkCreateTags({
				atomic: true,
				items: [
					{ name: 'Bug', color: '#e11d48' },
					{ name: 'Chore', color: '#a3a3a3' }
				]
			})
			.catch((thrown) => thrown);

		expect((refusal as ApiException).getStatus()).toBe(400);
		expect((refusal as ApiException).code).toBe(ApiErrorCode.BULK_ATOMIC_UNSUPPORTED);
		expect(tagService.create).not.toHaveBeenCalled();
		expect(writes).toEqual([]);
	});

	it('refuses a caller holding neither grant before the first item', async () => {
		const { resolver, tagService } = surfaces({ granted: [] });

		const refusal = await resolver
			.bulkCreateTags({ items: [{ name: 'Bug', color: '#e11d48' }] })
			.catch((thrown) => thrown);

		expect((refusal as ApiException).code).toBe(ApiErrorCode.PERMISSION_DENIED);
		expect(tagService.create).not.toHaveBeenCalled();
	});
});

describe('the declarations both surfaces run the batch from', () => {
	it('declares the batch as a POST on its own path, with the cap and the create route’s grants', () => {
		expect(Reflect.getMetadata(PATH_METADATA, TagController.prototype.bulk)).toBe('/bulk');
		expect(Reflect.getMetadata(METHOD_METADATA, TagController.prototype.bulk)).toBe(RequestMethod.POST);
		expect(readBulkOperation(TagController.prototype, 'bulk')).toEqual({
			resource: 'tag',
			maxItems: 200,
			permission: Reflect.getMetadata(PERMISSIONS_METADATA, TagController.prototype.create),
			atomic: false
		});
	});

	it('states the create route’s permission and guards on the route and on the field', () => {
		const create = Reflect.getMetadata(PERMISSIONS_METADATA, TagController.prototype.create);

		expect(create).toEqual([PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TAGS_ADD]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TagController.prototype.bulk)).toEqual(create);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TagResolver.prototype.bulkCreateTags)).toEqual(create);
		expect(Reflect.getMetadata('__guards__', TagController.prototype.bulk)).toEqual(
			Reflect.getMetadata('__guards__', TagController.prototype.create)
		);
		expect(Reflect.getMetadata('__guards__', TagResolver.prototype.bulkCreateTags)).toEqual(
			Reflect.getMetadata('__guards__', TagResolver.prototype.createTag)
		);
	});

	it('declares one retry scope on both surfaces, honoured and not demanded', () => {
		const route = Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, TagController.prototype.bulk);

		expect(route).toEqual({ scope: 'tag.bulk', required: false, resourceType: 'tag' });
		expect(Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, TagResolver.prototype.bulkCreateTags)).toEqual(route);
	});
});
