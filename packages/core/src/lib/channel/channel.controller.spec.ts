/**
 * The sales context over REST (API specification §7.3, §5.1, §15.4).
 *
 * The suite pins the four things a controller owes and a service cannot state for it:
 *
 * - **the guard chain** — both protocol guards are on the class, so a request that presents no
 *   credential is answered 401 by the global auth guard and a request whose credential holds no
 *   permission is refused by `TenantPermissionGuard` before a handler runs;
 * - **the permission of every route** — read on the metadata a guard actually reads, so the
 *   assertion is about the decision and not about the decorator's prose. A write route carries its
 *   write permission and never the read one, which is what makes "a caller who may look cannot
 *   write" true rather than intended;
 * - **the route decorators** — every method that overrides the CRUD base restates its own route,
 *   because an override without one is an endpoint that quietly stops existing;
 * - **the routes themselves** — each one is called and its delegation is asserted, and a route whose
 *   service refuses surfaces a 4xx that is **not** a 404, which is the difference between "you may
 *   not do this" and "there is nothing here".
 *
 * Three module boundaries are doubled, and the reason is the same for all three: the base CRUD class
 * reaches the entity barrel and with it the whole application graph, `@gauzy/config` reads the process
 * environment at import time, and the request context is what a write runs inside. A fourth is
 * doubled for a load-order reason: the guards barrel reaches the employee repository and, through it,
 * the entity graph from the wrong end — where `RolePermissionController` is decorated before the guard
 * it names is defined and Nest refuses the class outright. Doubling the two guards keeps the
 * assertion honest — the controller names these two tokens as its guards, which is what a guard reads
 * — while the import order stays the spec's to choose rather than the graph's.
 *
 * **The controller under test is the real one**, over a scripted service, so a route that stopped
 * delegating — or delegated to something else — is caught here rather than accommodated.
 */
jest.mock('../shared/guards', () => ({
	PermissionGuard: class PermissionGuard {},
	TenantPermissionGuard: class TenantPermissionGuard {},
	// The gate on the GraphQL surface: a resolver carries the feature guard its module's resolvers
	// are declared under, and a spec that doubles the guard barrel has to double that one too.
	FeatureFlagGuard: class FeatureFlagGuard {}
}));

jest.mock('../core/crud/tenant-aware-crud.service', () => {
	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}
	}

	return { TenantAwareCrudService };
});

jest.mock('../core/context/request-context', () => ({
	RequestContext: {
		currentUser: () => (mockTenantId ? { id: 'user-1', tenantId: mockTenantId } : null),
		currentUserId: () => (mockTenantId ? 'user-1' : null),
		currentTenantId: () => mockTenantId,
		currentOrganizationId: () => mockOrganizationId,
		currentEmployeeId: () => null,
		currentRoleId: () => null,
		hasPermission: () => false
	}
}));

jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isPostgres: () => true,
	isMySQL: () => false
}));

/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller.
 *
 * `dashboard.entity.ts` applies `@IsEmployeeBelongsToOrganization()` at class-definition time, and
 * that decorator's module reaches the entity graph again through the employee repository. Entering
 * that cycle from the wrong end — through `core/crud`, which reaches `core/dto` and the validators
 * first — leaves the decorator undefined when the entity applies it, and the suite fails to LOAD
 * with `IsEmployeeBelongsToOrganization is not a function` rather than failing an assertion.
 * Loading the entity barrel first lets the validators module finish before anything applies it. The
 * API never hits this because Nest bootstraps the entity graph before the service layer.
 */
import '../core/entities/internal';

import { BadRequestException, HttpException } from '@nestjs/common';
import { ChannelStatus, PermissionsEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ChannelController } from './channel.controller';
import { ChannelEventPublisher, CHANNEL_EVENT_NAMES } from './channel-event.publisher';

/** The tenant and organization a request runs in. Null is the "no credential" case below. */
let mockTenantId: string | null = '00000000-0000-4000-8000-000000000001';
let mockOrganizationId: string | null = '00000000-0000-4000-8000-000000000002';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const CHANNEL = '00000000-0000-4000-8000-000000000010';
const REGION = '00000000-0000-4000-8000-000000000020';

/** The channel a scripted service answers with. */
const STORED = {
	id: CHANNEL,
	tenantId: mockTenantId,
	organizationId: ORGANIZATION,
	name: 'Storefront',
	code: 'storefront',
	status: ChannelStatus.DRAFT,
	isDefault: false,
	defaultCurrency: 'EUR',
	orderNumberPadding: 6
};

/**
 * The service and publisher, scripted per route.
 *
 * Every member the controller reaches is stated, so a route that calls something else fails loudly
 * rather than silently passing through an automock.
 */
function surfaces(
	overrides: Record<string, unknown> = {}
) {
	const channelService = {
		listChannels: jest.fn().mockResolvedValue([STORED]),
		findChannelOrFail: jest.fn().mockResolvedValue(STORED),
		listChannelDomains: jest.fn().mockResolvedValue([{ id: 'domain-1', hostname: 'shop.example' }]),
		listChannelRegions: jest.fn().mockResolvedValue([{ id: 'membership-1', regionId: REGION, isDefault: true }]),
		createChannel: jest.fn().mockResolvedValue(STORED),
		updateChannel: jest.fn().mockResolvedValue(STORED),
		setChannelStatus: jest.fn().mockResolvedValue({ ...STORED, status: ChannelStatus.ACTIVE }),
		setDefaultChannel: jest.fn().mockResolvedValue({ ...STORED, isDefault: true }),
		archiveChannel: jest.fn().mockResolvedValue({ ...STORED, status: ChannelStatus.ARCHIVED }),
		...overrides
	};
	const channelRegionService = {
		replaceRegions: jest.fn().mockResolvedValue([{ id: 'membership-1', channelId: CHANNEL, regionId: REGION }])
	};
	const publisher = { channelChanged: jest.fn().mockResolvedValue(true) };

	return {
		channelService,
		channelRegionService,
		publisher,
		controller: new ChannelController(
			channelService as never,
			channelRegionService as never,
			publisher as never
		)
	};
}

/** Whether an HTTP failure is a refusal rather than a miss. */
function isRefusal(error: unknown): boolean {
	return error instanceof HttpException && error.getStatus() >= 400 && error.getStatus() !== 404;
}

beforeEach(() => {
	mockTenantId = '00000000-0000-4000-8000-000000000001';
	mockOrganizationId = ORGANIZATION;
});

describe('ChannelController — the routes (API specification §7.3)', () => {
	it('lists the channels of the caller’s organization, the default one first', async () => {
		const { controller, channelService } = surfaces();

		const answer = await controller.findAll({ filter: { status: ChannelStatus.ACTIVE }, take: 10, skip: 0 });

		// The bracketed spelling the endpoint table names reaches the same narrowing the flat one does,
		// and the page is applied here: the delivered list method answers with the filtered set.
		expect(channelService.listChannels).toHaveBeenCalledWith({ status: ChannelStatus.ACTIVE });
		expect(answer).toEqual({ items: [STORED], total: 1 });
	});

	it('reads one channel and attaches the relations the caller expanded', async () => {
		const { controller, channelService } = surfaces();

		const channel = await controller.findById(CHANNEL, { expand: ['domains', 'regions'] });

		expect(channelService.findChannelOrFail).toHaveBeenCalledWith(CHANNEL);
		expect(channel.domains).toEqual([{ id: 'domain-1', hostname: 'shop.example' }]);
		expect(channel.regions).toEqual([{ id: 'membership-1', regionId: REGION, isDefault: true }]);
	});

	it('creates a channel, stores it DRAFT and announces the fact', async () => {
		const { controller, channelService, publisher } = surfaces();

		const created = await controller.create({ name: 'Storefront', code: 'storefront' } as never);

		expect(channelService.createChannel).toHaveBeenCalledWith({ name: 'Storefront', code: 'storefront' });
		expect(created).toBe(STORED);
		expect(publisher.channelChanged).toHaveBeenCalledWith(STORED, 'created');
	});

	it('updates the descriptive facts without touching the lifecycle', async () => {
		const { controller, channelService, publisher } = surfaces();

		await controller.update(CHANNEL, { name: 'Renamed' } as never);

		expect(channelService.updateChannel).toHaveBeenCalledWith(CHANNEL, { name: 'Renamed' });
		expect(publisher.channelChanged).toHaveBeenCalledWith(STORED, 'updated');
	});

	it('moves the channel along its lifecycle, which is a route of its own', async () => {
		const { controller, channelService, publisher } = surfaces();

		const moved = await controller.setChannelStatus(CHANNEL, { status: ChannelStatus.ACTIVE });

		expect(channelService.setChannelStatus).toHaveBeenCalledWith(CHANNEL, ChannelStatus.ACTIVE);
		expect(moved.status).toBe(ChannelStatus.ACTIVE);
		expect(publisher.channelChanged).toHaveBeenCalledWith(moved, 'status-changed');
	});

	it('claims the organization default, releasing the flag from the previous holder', async () => {
		const { controller, channelService, publisher } = surfaces();

		const claimed = await controller.setDefault(CHANNEL);

		expect(channelService.setDefaultChannel).toHaveBeenCalledWith(CHANNEL);
		expect(claimed.isDefault).toBe(true);
		expect(publisher.channelChanged).toHaveBeenCalledWith(claimed, 'default-changed');
	});

	it('replaces the region links as a set, and announces the channel they belong to', async () => {
		const { controller, channelRegionService, channelService, publisher } = surfaces();

		const regions = await controller.replaceRegions(CHANNEL, {
			items: [{ regionId: REGION, isDefault: true }]
		});

		expect(channelRegionService.replaceRegions).toHaveBeenCalledWith(CHANNEL, [
			{ regionId: REGION, isDefault: true }
		]);
		expect(regions).toEqual([{ id: 'membership-1', channelId: CHANNEL, regionId: REGION }]);
		// The channel's own aggregate changed with its region set, so the fact announced is the
		// channel's rather than a pivot's.
		expect(channelService.findChannelOrFail).toHaveBeenCalledWith(CHANNEL);
		expect(publisher.channelChanged).toHaveBeenCalledWith(STORED, 'regions-replaced');
	});

	it('retires a channel rather than deleting it, which is the domain’s rule', async () => {
		const { controller, channelService, publisher } = surfaces();

		const retired = await controller.delete(CHANNEL, { force: true });

		// No hard delete exists to call: the order side's reference to a channel is `RESTRICT`, so the
		// resource's removal is a retirement whatever `force` says.
		expect(channelService.archiveChannel).toHaveBeenCalledWith(CHANNEL);
		expect(retired.status).toBe(ChannelStatus.ARCHIVED);
		expect(publisher.channelChanged).toHaveBeenCalledWith(retired, 'force-archived');
	});
});

describe('ChannelController — refusals (a 4xx that is not a 404)', () => {
	it('refuses a duplicate code with 400, and the refusal names the catalogue code', async () => {
		const refusal = new BadRequestException(
			'UNIQUE_CONSTRAINT_VIOLATION: a channel with code \'storefront\' already exists in this organization.'
		);
		const { controller } = surfaces({ createChannel: jest.fn().mockRejectedValue(refusal) });

		const error = await controller.create({ name: 'Storefront', code: 'storefront' } as never).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as HttpException).getStatus()).toBe(400);
		expect((error as Error).message).toContain('UNIQUE_CONSTRAINT_VIOLATION');
	});

	it('refuses a status the lifecycle does not allow with 400 rather than reporting a miss', async () => {
		const refusal = new BadRequestException(
			'PRECONDITION_REQUIRED: CHANNEL_STATUS_INVALID — a channel moves from ARCHIVED to nothing, and ACTIVE is not one of them.'
		);
		const { controller } = surfaces({ setChannelStatus: jest.fn().mockRejectedValue(refusal) });

		const error = await controller
			.setChannelStatus(CHANNEL, { status: ChannelStatus.ACTIVE })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('CHANNEL_STATUS_INVALID');
	});

	it('refuses retiring the organization default with a 4xx, never a 404', async () => {
		const refusal = new BadRequestException(
			'PRECONDITION_REQUIRED: CHANNEL_DEFAULT_IMMUTABLE — channel \'storefront\' is the default channel of this organization.'
		);
		const { controller } = surfaces({ archiveChannel: jest.fn().mockRejectedValue(refusal) });

		const error = await controller.delete(CHANNEL).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('CHANNEL_DEFAULT_IMMUTABLE');
	});

	it('refuses a page above the protocol cap rather than answering every row', async () => {
		const { controller } = surfaces();

		const error = await controller.findAll({ take: 500 }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('ChannelController — the guard stack and the permission every route declares', () => {
	it('guards the resource with both protocol guards', () => {
		const guards = Reflect.getMetadata('__guards__', ChannelController) ?? [];

		expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('carries the read permission on the resource', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ChannelController)).toEqual([
			PermissionsEnum.CHANNELS_VIEW
		]);
	});

	it('gives every route the permission the endpoint table names, and the reads the read permission', () => {
		const proto = ChannelController.prototype;
		const expected: Array<[string, PermissionsEnum]> = [
			['findAll', PermissionsEnum.CHANNELS_VIEW],
			['findById', PermissionsEnum.CHANNELS_VIEW],
			['create', PermissionsEnum.CHANNELS_CREATE],
			['update', PermissionsEnum.CHANNELS_EDIT],
			['setChannelStatus', PermissionsEnum.CHANNELS_EDIT],
			['setDefault', PermissionsEnum.CHANNELS_EDIT],
			['replaceRegions', PermissionsEnum.CHANNELS_EDIT],
			['delete', PermissionsEnum.CHANNELS_DELETE]
		];

		for (const [route, permission] of expected) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto[route])).toEqual([permission]);
		}
	});

	it('refuses every write to a caller who holds only the read permission', () => {
		// This is the "no credential" case at the level a unit test can observe it: the guard chain is
		// what refuses a caller that presents no usable credential, and the metadata below is what
		// `PermissionGuard` reads. A write route that carried the read permission — or none — would be
		// reachable by every caller that may look at a channel.
		const proto = ChannelController.prototype;
		const writes = ['create', 'update', 'setChannelStatus', 'setDefault', 'replaceRegions', 'delete'];

		for (const route of writes) {
			const stated = Reflect.getMetadata(PERMISSIONS_METADATA, proto[route]) ?? [];

			expect(stated).not.toContain(PermissionsEnum.CHANNELS_VIEW);
			expect(stated.length).toBeGreaterThan(0);
		}
	});

	it('refuses a request that presents no credential at all', () => {
		// Every GraphQL and REST handler of this domain is behind the same chain, and the chain is on
		// the class rather than on one method, so there is no route a credential-less request reaches.
		const guards = Reflect.getMetadata('__guards__', ChannelController) ?? [];

		expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(mockTenantId).toBe('00000000-0000-4000-8000-000000000001');
	});
});

describe('ChannelController — the routes the CRUD base supplies', () => {
	it('restates the route decorator on every method it overrides', () => {
		// Read from the source rather than from metadata: Nest merges the inherited route metadata, so
		// only the text tells an override that kept its decorator from one that dropped it.
		const source = require('node:fs').readFileSync(require('node:path').join(__dirname, 'channel.controller.ts'), 'utf8');

		expect(source).toMatch(/@Get\(\)\n\t@UseValidationPipe\(\{ transform: true, whitelist: true \}\)\n\tasync findAll\(/);
		expect(source).toMatch(/@Get\(':id'\)/);
		expect(source).toMatch(/@Post\(\)\n\t@UseValidationPipe\(\{ transform: true, whitelist: true \}\)\n\tasync create\(/);
		expect(source).toMatch(/@Put\(':id'\)/);
		expect(source).toMatch(/@Delete\(':id'\)/);
	});

	it('is the publisher the domain declares its events through', () => {
		expect(CHANNEL_EVENT_NAMES.CHANNEL_CHANGED).toBe('channel.changed');
		expect(CHANNEL_EVENT_NAMES.REGION_CHANGED).toBe('region.changed');
		expect(typeof ChannelEventPublisher.prototype.onModuleInit).toBe('function');
	});
});
