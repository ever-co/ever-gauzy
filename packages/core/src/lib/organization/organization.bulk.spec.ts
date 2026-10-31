/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AGENT_RESTRICTION_ON_CREATE_ERR_MSG, CurrenciesEnum, PermissionsEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { BulkExecutor } from '../api/bulk-executor.service';
import { readBulkOperation } from '../api/bulk.decorator';
import { FieldVisibility } from '../api/field-visibility.service';
import { RequestContext } from '../core/context';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import { IDEMPOTENT_METADATA_KEY } from '../idempotency/idempotency.policy';
import { OrganizationCreateHandler } from './commands/handlers/organization.create.handler';
import { OrganizationController } from './organization.controller';
import { OrganizationResolver } from './organization.resolver';

/**
 * `POST /organization/bulk` and `bulkCreateOrganizations`: many organizations in one request, each created
 * exactly as `POST /organization` and `createOrganization` create one.
 *
 * The handler under the batch is the real `OrganizationCreateHandler`, over scripted services: an
 * organization create is the widest single create on the platform — the row, the memberships of the
 * tenant's administrators, the contact row, the commerce defaults, and the task defaults it seeds without
 * awaiting them — and a batch has to produce every one of those for every item, and refuse an item for the
 * reason the single create would refuse it.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';

/** The grants of the caller, as the platform's field visibility reads them. */
function visibilityFor(granted: PermissionsEnum[]): FieldVisibility {
	return {
		canSee: (permission: PermissionsEnum) => granted.includes(permission),
		assertCanSee: (permission: PermissionsEnum) => {
			if (!granted.includes(permission)) {
				throw new ApiException(403, ApiErrorCode.PERMISSION_DENIED, 'Denied.', { permission });
			}
		}
	} as unknown as FieldVisibility;
}

/**
 * Both surfaces over the real create handler, with every write it performs recorded in one log the way a
 * database records it: a transaction that threw leaves nothing behind.
 */
function surfaces(options: { granted?: PermissionsEnum[] } = {}) {
	const log: string[] = [];
	const organizations: Array<Record<string, any>> = [];

	const organizationService = {
		tableName: 'organization',
		create: jest.fn(async (payload: Record<string, any>) => {
			const row: Record<string, any> = {
				...payload,
				id: `organization-${organizations.length + 1}`,
				tenantId: TENANT
			};
			organizations.push(row);
			log.push(`organization ${row.name}`);

			return row;
		}),
		update: jest.fn(async (id: string) => {
			log.push(`contact of ${id}`);
		}),
		findOneByIdString: jest.fn(async (id: string) => organizations.find((row) => row.id === id))
	};
	const userService = {
		find: jest.fn().mockResolvedValue([{ id: 'super-admin-1' }])
	};
	const userOrganizationService = {
		tableName: 'user_organization',
		create: jest.fn(async ({ organization, user }: { organization: { id: string }; user: { id: string } }) => {
			log.push(`member ${user.id} of ${organization.id}`);

			return { id: `membership-${organization.id}` };
		})
	};
	const contactService = { create: jest.fn(async () => ({ id: 'contact-1' })) };
	const commands = {
		execute: jest.fn(async (command: object) => {
			log.push(command.constructor.name);
		})
	};
	const handler = new OrganizationCreateHandler(
		commands as never,
		organizationService as never,
		userOrganizationService as never,
		userService as never,
		contactService as never,
		{ create: jest.fn() } as never
	);
	const commandBus = { execute: jest.fn((command) => handler.execute(command)) };

	const executor = new BulkExecutor(visibilityFor(options.granted ?? [PermissionsEnum.ALL_ORG_EDIT]));

	return {
		log,
		organizations,
		controller: new OrganizationController(organizationService as never, commandBus as never, executor),
		resolver: new OrganizationResolver(organizationService as never, commandBus as never, executor)
	};
}

/** Lets the fire-and-forget task defaults the handler starts finish, as the request outlives them. */
const settled = () => new Promise((resolve) => setImmediate(resolve));

/** An organization body as `POST /organization` takes it. */
const body = (name: string, extra: Record<string, unknown> = {}): never =>
	({ name, currency: CurrenciesEnum.USD, ...extra }) as never;

beforeEach(() => {
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	jest.spyOn(RequestContext, 'hasRole').mockReturnValue(false);
});

afterEach(() => jest.restoreAllMocks());

describe('POST /organization/bulk — each item is POST /organization', () => {
	it('creates for every item what the single create creates, in the same order', async () => {
		const batch = surfaces();
		const single = surfaces();
		const items = [body('Acme'), body('Globex')];

		const result = await batch.controller.bulk({ items });
		await settled();

		for (const item of items) {
			await single.controller.create(item as never);
		}
		await settled();

		expect(result).toMatchObject({ total: 2, succeededCount: 2, failedCount: 0 });
		expect(result.succeeded.map((entry) => entry.id)).toEqual(['organization-1', 'organization-2']);
		// The row, the administrator's membership, the contact, the commerce defaults and the six task
		// defaults — for each item, exactly what the two single creates wrote.
		expect(batch.log).toEqual(single.log);
		expect(batch.log).toEqual(
			expect.arrayContaining([
				'organization Acme',
				'member super-admin-1 of organization-1',
				'contact of organization-1',
				'OrganizationCommerceDefaultsCreateCommand',
				'organization Globex',
				'member super-admin-1 of organization-2'
			])
		);
	});

	it('reports an item the create refuses with the create’s own reason, and creates the rest', async () => {
		const { controller, organizations } = surfaces();

		const result = await controller.bulk({
			items: [body('Acme'), body('Restricted', { allowAgentAppExit: false }), { name: 'No currency' } as never]
		});

		expect(result.succeeded.map((entry) => entry.index)).toEqual([0]);
		expect(result.failed).toEqual([
			expect.objectContaining({
				index: 1,
				code: ApiErrorCode.VALIDATION_FAILED,
				message: AGENT_RESTRICTION_ON_CREATE_ERR_MSG
			}),
			expect.objectContaining({
				index: 2,
				code: ApiErrorCode.VALIDATION_FAILED,
				details: { messages: expect.arrayContaining(['currency should not be empty']) }
			})
		]);
		expect(organizations.map((row) => row.name)).toEqual(['Acme']);
	});

	it('refuses an atomic batch before writing anything', async () => {
		const { controller, organizations, log } = surfaces();

		const refusal = await controller
			.bulk({ atomic: true, items: [body('Acme'), body('Globex')] })
			.catch((thrown) => thrown);

		// Each item is OrganizationCreateCommand, which writes through its own repositories and seeds defaults
		// it does not await: no transaction could roll the batch back as one, so the route refuses the flag.
		expect((refusal as ApiException).getStatus()).toBe(400);
		expect((refusal as ApiException).code).toBe(ApiErrorCode.BULK_ATOMIC_UNSUPPORTED);
		expect((refusal as ApiException).details).toEqual({ field: 'atomic', resource: 'organization' });
		expect(organizations).toEqual([]);
		expect(log).toEqual([]);
	});

	it('refuses a batch above its cap, and a caller without the create route’s grant, before creating anything', async () => {
		const capped = surfaces();
		const denied = surfaces({ granted: [PermissionsEnum.ALL_ORG_VIEW] });

		const tooMany = await capped.controller
			.bulk({ items: Array.from({ length: 21 }, (_unused, index) => body(`Org ${index}`)) })
			.catch((thrown) => thrown);
		const refused = await denied.controller.bulk({ items: [body('Acme')] }).catch((thrown) => thrown);

		// The cap is 20, not the platform's 200: each create seeds the organization's defaults.
		expect((tooMany as ApiException).code).toBe(ApiErrorCode.BULK_LIMIT_EXCEEDED);
		expect((tooMany as ApiException).details).toEqual({ limit: 20, actual: 21 });
		expect((refused as ApiException).code).toBe(ApiErrorCode.PERMISSION_DENIED);
		expect(capped.organizations).toEqual([]);
		expect(denied.organizations).toEqual([]);
	});
});

describe('bulkCreateOrganizations — the same batch over GraphQL, each item `createOrganization`', () => {
	it('creates each item through the same command, one outcome per item', async () => {
		const { resolver, organizations } = surfaces();

		const payload = await resolver.bulkCreateOrganizations({
			items: [
				{ name: 'Acme', currency: CurrenciesEnum.USD },
				{ name: 'Restricted', currency: CurrenciesEnum.USD, allowAgentAppExit: false }
			] as never
		});

		expect(payload).toMatchObject({ succeeded: 1, failed: 1, total: 2 });
		expect(payload.results[1]).toMatchObject({
			ok: false,
			error: {
				code: ApiErrorCode.VALIDATION_FAILED,
				message: AGENT_RESTRICTION_ON_CREATE_ERR_MSG,
				path: ['items', '1']
			}
		});
		expect(organizations.map((row) => row.name)).toEqual(['Acme']);
	});

	it('refuses an atomic batch before writing anything, exactly as the route does', async () => {
		const { resolver, organizations } = surfaces();

		const refusal = await resolver
			.bulkCreateOrganizations({ atomic: true, items: [{ name: 'Acme', currency: CurrenciesEnum.USD }] as never })
			.catch((thrown) => thrown);

		expect((refusal as ApiException).getStatus()).toBe(400);
		expect((refusal as ApiException).code).toBe(ApiErrorCode.BULK_ATOMIC_UNSUPPORTED);
		expect(organizations).toEqual([]);
	});
});

describe('the declarations both surfaces run the batch from', () => {
	it('declares the batch as a POST on its own path, under the grant the create route runs under', () => {
		expect(Reflect.getMetadata(PATH_METADATA, OrganizationController.prototype.bulk)).toBe('/bulk');
		expect(Reflect.getMetadata(METHOD_METADATA, OrganizationController.prototype.bulk)).toBe(RequestMethod.POST);
		expect(readBulkOperation(OrganizationController.prototype, 'bulk')).toEqual({
			resource: 'organization',
			maxItems: 20,
			permission: PermissionsEnum.ALL_ORG_EDIT,
			atomic: false
		});
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationController.prototype.create)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationController.prototype.bulk)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationController)).toEqual([
			PermissionsEnum.ALL_ORG_EDIT
		]);
		expect(
			Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationResolver.prototype.bulkCreateOrganizations)
		).toEqual(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationResolver.prototype.createOrganization));
	});

	it('declares one retry scope on both surfaces, honoured and not demanded', () => {
		const route = Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, OrganizationController.prototype.bulk);

		expect(route).toEqual({ scope: 'organization.bulk', required: false, resourceType: 'organization' });
		expect(
			Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, OrganizationResolver.prototype.bulkCreateOrganizations)
		).toEqual(route);
	});
});
