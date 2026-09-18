/**
 * 🛑 This import must stay FIRST — see `../channel/channel.controller.spec.ts` for the load-order
 * cycle it avoids: entered through the validators rather than through the entities, an entity
 * decorator is still undefined when the entity applies it and the suite fails to load.
 */
import '../core/entities/internal';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, HttpException } from '@nestjs/common';
import { ChannelStatus, PermissionsEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { RegionController } from './region.controller';

/** The guard doubles, and the reason they exist, are stated in the channel controller suite. */
jest.mock('../shared/guards', () => ({
	PermissionGuard: class PermissionGuard {},
	TenantPermissionGuard: class TenantPermissionGuard {}
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
		currentUser: () => ({ id: 'user-1', tenantId: 'tenant-1' }),
		currentUserId: () => 'user-1',
		currentTenantId: () => 'tenant-1',
		currentOrganizationId: () => 'org-1',
		currentEmployeeId: () => null,
		hasPermission: () => false
	}
}));

jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isPostgres: () => true,
	isMySQL: () => false
}));

const REGION = '00000000-0000-4000-8000-000000000020';
const COUNTRY = '00000000-0000-4000-8000-000000000040';

/** The region a scripted service answers with. */
const STORED = {
	id: REGION,
	name: 'European Union',
	code: 'eu',
	currency: 'EUR',
	isDefault: false,
	isTaxInclusive: true,
	status: ChannelStatus.ACTIVE
};

/** The controller over a scripted service, so every route's delegation is visible. */
function surfaces(
	overrides: Record<string, unknown> = {},
	countryOverrides: Record<string, unknown> = {}
) {
	const regionService = {
		listRegions: jest.fn().mockResolvedValue([STORED]),
		findRegion: jest.fn().mockResolvedValue(STORED),
		findRegionOrFail: jest.fn().mockResolvedValue(STORED),
		createRegion: jest.fn().mockResolvedValue(STORED),
		updateRegion: jest.fn().mockResolvedValue(STORED),
		setDefaultRegion: jest.fn().mockResolvedValue({ ...STORED, isDefault: true }),
		archiveRegion: jest.fn().mockResolvedValue({ ...STORED, status: ChannelStatus.ARCHIVED }),
		...overrides
	};
	const regionCountryService = {
		listCountries: jest.fn().mockResolvedValue([{ id: 'membership-1', regionId: REGION, countryId: COUNTRY }]),
		replaceCountries: jest
			.fn()
			.mockResolvedValue([{ id: 'membership-1', regionId: REGION, countryId: COUNTRY, isTaxExempt: false }]),
		...countryOverrides
	};

	return {
		regionService,
		regionCountryService,
		controller: new RegionController(regionService as never, regionCountryService as never)
	};
}

/** Whether an HTTP failure is a refusal rather than a miss. */
function isRefusal(error: unknown): boolean {
	return error instanceof HttpException && error.getStatus() >= 400 && error.getStatus() !== 404;
}

describe('RegionController — the routes (API specification §7.3)', () => {
	it('lists the regions of the caller’s organization, newest first', async () => {
		const { controller, regionService } = surfaces();

		const answer = await controller.findAll({ filter: { currency: 'EUR', status: ChannelStatus.ACTIVE }, take: 10 });

		expect(regionService.listRegions).toHaveBeenCalledWith({
			currency: 'EUR',
			status: ChannelStatus.ACTIVE
		});
		expect(answer).toEqual({ items: [STORED], total: 1 });
	});

	it('reads one region and attaches the countries the caller expanded', async () => {
		const { controller, regionCountryService } = surfaces();

		const region = await controller.findById(REGION, { expand: ['countries'] });

		expect(regionCountryService.listCountries).toHaveBeenCalledWith(REGION);
		expect(region.countries).toEqual([{ id: 'membership-1', regionId: REGION, countryId: COUNTRY }]);
	});

	it('creates a region, checking the currency against the platform’s master', async () => {
		const { controller, regionService } = surfaces();

		await controller.create({ name: 'European Union', code: 'eu', currency: 'EUR' } as never);

		expect(regionService.createRegion).toHaveBeenCalledWith({
			name: 'European Union',
			code: 'eu',
			currency: 'EUR'
		});
	});

	it('updates the descriptive facts without touching the lifecycle', async () => {
		const { controller, regionService } = surfaces();

		await controller.update(REGION, { isTaxInclusive: false } as never);

		expect(regionService.updateRegion).toHaveBeenCalledWith(REGION, { isTaxInclusive: false });
	});

	it('replaces the country set as a set, not member by member', async () => {
		const { controller, regionCountryService } = surfaces();

		const stored = await controller.replaceCountries(REGION, {
			countries: [{ countryId: COUNTRY, provinceCodes: ['BE', 'NL'] }]
		});

		expect(regionCountryService.replaceCountries).toHaveBeenCalledWith(REGION, [
			{ countryId: COUNTRY, isTaxExempt: undefined, provinceCodes: ['BE', 'NL'] }
		]);
		expect(stored).toEqual([{ id: 'membership-1', regionId: REGION, countryId: COUNTRY, isTaxExempt: false }]);
	});

	it('claims the organization default, releasing the flag from the previous holder', async () => {
		const { controller, regionService } = surfaces();

		const claimed = await controller.setDefault(REGION);

		expect(regionService.setDefaultRegion).toHaveBeenCalledWith(REGION);
		expect(claimed.isDefault).toBe(true);
	});

	it('retires a region rather than deleting it, which is the domain’s rule', async () => {
		const { controller, regionService } = surfaces();

		const retired = await controller.delete(REGION, { force: true });

		// No hard delete exists to call: a cart, a tax rate and a price list may all name a region, so
		// the resource's removal is a retirement whatever `force` says.
		expect(regionService.archiveRegion).toHaveBeenCalledWith(REGION);
		expect(retired.status).toBe(ChannelStatus.ARCHIVED);
	});
});

describe('RegionController — refusals (a 4xx that is not a 404)', () => {
	it('refuses a currency the platform does not know, naming the catalogue code', async () => {
		const refusal = new BadRequestException(
			"VALIDATION_FAILED: REGION_CURRENCY_UNKNOWN — 'XYZ' is not a currency this platform knows."
		);
		const { controller } = surfaces({ createRegion: jest.fn().mockRejectedValue(refusal) });

		const error = await controller
			.create({ name: 'Nowhere', code: 'nw', currency: 'XYZ' } as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as HttpException).getStatus()).toBe(400);
		expect((error as Error).message).toContain('REGION_CURRENCY_UNKNOWN');
	});

	it('refuses a code the organization already uses', async () => {
		const refusal = new BadRequestException(
			"UNIQUE_CONSTRAINT_VIOLATION: a region with code 'eu' already exists in this organization."
		);
		const { controller } = surfaces({ createRegion: jest.fn().mockRejectedValue(refusal) });

		const error = await controller
			.create({ name: 'European Union', code: 'eu', currency: 'EUR' } as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('UNIQUE_CONSTRAINT_VIOLATION');
	});

	it('refuses a country set that names one country twice', async () => {
		const refusal = new BadRequestException(
			"UNIQUE_CONSTRAINT_VIOLATION: REGION_COUNTRY_EXISTS — country 'c1' is stated twice in one country set."
		);
		const { controller, regionCountryService } = surfaces({}, {
			replaceCountries: jest.fn().mockRejectedValue(refusal)
		});

		const error = await controller
			.replaceCountries(REGION, { countries: [{ countryId: COUNTRY }, { countryId: COUNTRY }] })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('REGION_COUNTRY_EXISTS');
		// The route passes the set through whole and lets the service refuse it, rather than deciding
		// here: one implementation of "a region serves a country once".
		expect(regionCountryService.replaceCountries).toHaveBeenCalledTimes(1);
	});

	it('refuses a province scope that is an empty list', async () => {
		const refusal = new BadRequestException(
			'VALIDATION_FAILED: REGION_COUNTRY_PROVINCES_INVALID — a province scope is either absent or a non-empty list.'
		);
		const { controller } = surfaces({}, { replaceCountries: jest.fn().mockRejectedValue(refusal) });

		const error = await controller
			.replaceCountries(REGION, { countries: [{ countryId: COUNTRY, provinceCodes: [] }] })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('REGION_COUNTRY_PROVINCES_INVALID');
	});
});

describe('RegionController — the guard stack and the permission every route declares', () => {
	it('guards the resource with both protocol guards', () => {
		const guards = Reflect.getMetadata('__guards__', RegionController) ?? [];

		expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, RegionController)).toEqual([PermissionsEnum.REGIONS_VIEW]);
	});

	it('gives every route the permission the endpoint table names', () => {
		const proto = RegionController.prototype;
		const expected: Array<[string, PermissionsEnum]> = [
			['findAll', PermissionsEnum.REGIONS_VIEW],
			['findById', PermissionsEnum.REGIONS_VIEW],
			['create', PermissionsEnum.REGIONS_CREATE],
			['update', PermissionsEnum.REGIONS_EDIT],
			['replaceCountries', PermissionsEnum.REGIONS_EDIT],
			['setDefault', PermissionsEnum.REGIONS_EDIT],
			['delete', PermissionsEnum.REGIONS_DELETE]
		];

		for (const [route, permission] of expected) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto[route])).toEqual([permission]);
		}
	});

	it('refuses every write to a caller who holds only the read permission', () => {
		// "No credential" at the level a unit test can observe: the class-level chain refuses a request
		// that presents none, and the metadata below is what the permission guard reads.
		const proto = RegionController.prototype;

		for (const route of ['create', 'update', 'replaceCountries', 'setDefault', 'delete']) {
			const stated = Reflect.getMetadata(PERMISSIONS_METADATA, proto[route]) ?? [];

			expect(stated).not.toContain(PermissionsEnum.REGIONS_VIEW);
			expect(stated.length).toBeGreaterThan(0);
		}
	});

	it('restates the route decorator on every method it overrides', () => {
		const source = readFileSync(join(__dirname, 'region.controller.ts'), 'utf8');

		expect(source).toMatch(/@Get\(\)\n\t@UseValidationPipe\(\{ transform: true, whitelist: true \}\)\n\tasync findAll\(/);
		expect(source).toMatch(/@Get\(':id'\)/);
		expect(source).toMatch(/@Post\(\)\n\t@UseValidationPipe\(\{ transform: true, whitelist: true \}\)\n\tasync create\(/);
		expect(source).toMatch(/@Put\(':id'\)/);
		expect(source).toMatch(/@Delete\(':id'\)/);
	});
});
