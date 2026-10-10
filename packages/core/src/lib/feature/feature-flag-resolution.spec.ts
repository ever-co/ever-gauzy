/**
 * `uuid` ships ESM only, which Jest does not transform out of `node_modules` — a counter based stub
 * keeps the ids unique and the module graph CommonJS, exactly as `feature-catalogue.spec.ts` does.
 */
jest.mock('uuid', () => {
	let counter = 0;
	return { v4: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}` };
});

/**
 * Loaded first, before the subscriber below: `feature.subscriber.ts` reaches `core/file-storage`, whose
 * module graph re-enters the entity graph, and entering it from there leaves a decorator mid-initialised.
 * This is the same pre-import `tenant-aware-crud.service.spec.ts` opens with.
 */
import '../core/entities/internal';

import { gauzyToggleFeatures } from '@gauzy/config';
import { FeatureEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { Feature } from './feature.entity';
import { FeatureSubscriber } from './feature.subscriber';
import { FeatureService } from './feature.service';

/**
 * Where enablement is read from, and what happens when nothing has stored one.
 *
 * `feature` is the catalogue: one row per code, the same row for every tenant, and no `isEnabled`
 * column at all — the field is virtual, and `FeatureSubscriber.afterEntityLoad` assigns it on every
 * read. `feature_organization` is the switchboard: one row per tenant, and a second, more specific row
 * per organization when an administrator has set one. A resolution that reads the catalogue row can
 * therefore never see what an administrator switched, which is what this suite pins down.
 *
 * Nothing here needs a database. Each double reads an in-memory table, and the catalogue doubles run the
 * real subscriber on every row they return — the point being that the virtual field must carry what
 * production puts there, or a spec can pass while the defect is still present. The cases below assert an
 * enabled toggle wins over a catalogue row that loads as disabled, so a resolution that went back to
 * reading `feature.isEnabled` fails them.
 */

/** A row of the `feature` table as the double holds it. Deliberately without an `isEnabled` column. */
interface ICatalogueRow {
	id: string;
	code: string;
	name: string;
}

/** A row of the `feature_organization` table: one tenant's answer, at one scope. */
interface IToggleRow {
	id: string;
	tenantId: string;
	organizationId: string | null;
	featureId: string;
	isEnabled: boolean;
}

const TENANT = 'tenant-uuid-1';
const OTHER_TENANT = 'tenant-uuid-2';
const ORGANIZATION = 'organization-uuid-1';
const OTHER_ORGANIZATION = 'organization-uuid-2';

/**
 * A commerce code, in the shape the guard and the plugins carry it.
 *
 * These codes are not members of the compiled `FeatureEnum` — a package registers a code as text and
 * the guard compares text — so a spec has to cast them the same way `warehouse.features.ts` does.
 */
const commerceCode = (code: string): FeatureEnum => code as unknown as FeatureEnum;

const WAREHOUSE = commerceCode('FEATURE_WAREHOUSE');
const ORDER = commerceCode('FEATURE_ORDER');

const WAREHOUSE_FEATURE_ID = 'feature-uuid-warehouse';
const ORDER_FEATURE_ID = 'feature-uuid-order';

/** The catalogue the double serves: a default-off code, and one the catalogue marks on by default. */
const CATALOGUE: ICatalogueRow[] = [
	{ id: WAREHOUSE_FEATURE_ID, code: 'FEATURE_WAREHOUSE', name: 'Warehouse management' },
	{ id: ORDER_FEATURE_ID, code: 'FEATURE_ORDER', name: 'Orders' }
];

/** The subscriber the real read runs, so the double's virtual field is production's value. */
const featureSubscriber = new FeatureSubscriber();

/**
 * Loads a catalogue row the way the repository does.
 *
 * `afterEntityLoad` is where the subscriber assigns the virtual `isEnabled`, so the double takes the
 * value from there rather than from a hand-written rule of its own that could drift from it.
 *
 * It is deliberately **not** `afterLoad`: that wrapper dereferences `event.manager` even though it
 * declares the event optional, so an `afterLoad(entity)` call with no event throws into its own
 * `catch` and assigns nothing — a double built on it would hand every resolution `undefined` and pass
 * for exactly the wrong reason.
 *
 * @param row The in-memory row.
 * @returns The entity the resolution under test would receive.
 */
const loadCatalogueRow = async (row: ICatalogueRow): Promise<Feature> => {
	const entity = { ...row } as Feature;
	await featureSubscriber.afterEntityLoad(entity);
	return entity;
};

/**
 * The catalogue rows one criteria names.
 *
 * The code is required: the real lookup always carries one, so a criteria this double cannot read has
 * to fail loudly here rather than answer with the whole table — a repository fake that quietly matches
 * everything is how an unscoped or mis-shaped read passes a suite.
 */
const matchCatalogue = (rows: ICatalogueRow[], criteria: { code?: string } | undefined): ICatalogueRow[] => {
	if (!criteria?.code) {
		throw new Error(`the catalogue read must name a code, got ${JSON.stringify(criteria)}`);
	}
	return rows.filter((row) => row.code === criteria.code);
};

/** The `feature` table double, as the TypeORM repository the service reads through. */
const createTypeOrmFeatureRepository = (rows: ICatalogueRow[]) => ({
	findOneBy: jest.fn(async (criteria: { code?: string }) => {
		const [row] = matchCatalogue(rows, criteria);
		return row ? await loadCatalogueRow(row) : null;
	})
});

/** The same table as the MikroORM repository, whose `findOne` takes the same criteria shape. */
const createMikroOrmFeatureRepository = (rows: ICatalogueRow[]) => ({
	findOne: jest.fn(async (criteria: { code?: string }) => {
		const [row] = matchCatalogue(rows, criteria);
		return row ? await loadCatalogueRow(row) : null;
	})
});

/**
 * The toggle rows one criteria names.
 *
 * Both keys are required, for the reason {@link matchCatalogue} states: the real query is scoped by
 * tenant and catalogue entry, and a fake that matched on neither would let an unscoped read — which in
 * production would hand back another tenant's switch — look correct.
 */
const matchToggles = (rows: IToggleRow[], criteria: Partial<IToggleRow> | undefined): IToggleRow[] => {
	if (!criteria?.tenantId || criteria.featureId === undefined) {
		throw new Error(`the toggle read must be scoped by tenant and feature, got ${JSON.stringify(criteria)}`);
	}
	return rows.filter((row) => row.tenantId === criteria.tenantId && row.featureId === criteria.featureId);
};

/** The `feature_organization` table double, as the TypeORM repository (whose `find` takes options). */
const createTypeOrmToggleRepository = (rows: IToggleRow[]) => ({
	find: jest.fn(async (options: { where?: Partial<IToggleRow> } = {}) => matchToggles(rows, options?.where))
});

/** The same table as the MikroORM repository, whose `find` takes the criteria directly. */
const createMikroOrmToggleRepository = (rows: IToggleRow[]) => ({
	find: jest.fn(async (criteria: Partial<IToggleRow> = {}) => matchToggles(rows, criteria))
});

/** The service under test, over the two tables. */
const createService = (catalogue: ICatalogueRow[], toggles: IToggleRow[]) =>
	new FeatureService(
		createTypeOrmFeatureRepository(catalogue) as any,
		createMikroOrmFeatureRepository(catalogue) as any,
		createTypeOrmToggleRepository(toggles) as any,
		createMikroOrmToggleRepository(toggles) as any
	);

/** One stored toggle row, at tenant scope unless an organization is named. */
const toggle = (
	featureId: string,
	isEnabled: boolean,
	organizationId: string | null = null,
	tenantId: string = TENANT
): IToggleRow => ({
	id: `toggle-${featureId}-${organizationId ?? 'tenant'}-${tenantId}`,
	tenantId,
	organizationId,
	featureId,
	isEnabled
});

/** Puts the caller inside a tenant, and inside one of its organizations when one is named. */
const actingIn = (tenantId: string, organizationId: string | null = null) => {
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(tenantId);
	jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(organizationId);
};

describe('the catalogue read the double models', () => {
	afterEach(() => jest.restoreAllMocks());

	it('assigns the virtual field on load, as the real read does, rather than leaving it unset', async () => {
		const loaded = await loadCatalogueRow(CATALOGUE[0]);

		// The deployment's configuration does not name the code and the catalogue does not mark it on,
		// so the value the resolution receives is a definite `false` — never `undefined`. This is the
		// premise every case below rests on: the field is populated, and it still is not the answer.
		expect(gauzyToggleFeatures['FEATURE_WAREHOUSE']).toBeUndefined();
		expect(loaded.isEnabled).toBe(false);
	});

	it('assigns it `true` for a code the catalogue marks on by default', async () => {
		const loaded = await loadCatalogueRow(CATALOGUE[1]);

		expect(gauzyToggleFeatures['FEATURE_ORDER']).toBeUndefined();
		expect(loaded.isEnabled).toBe(true);
	});
});

describe('FeatureService.isFeatureEnabled', () => {
	afterEach(() => jest.restoreAllMocks());

	it('answers enabled for a tenant whose tenant-wide toggle is enabled', async () => {
		actingIn(TENANT);
		const service = createService(CATALOGUE, [toggle(WAREHOUSE_FEATURE_ID, true)]);

		// the catalogue row for this code loads with `isEnabled: false`; the stored toggle is the answer
		await expect(service.isFeatureEnabled(WAREHOUSE)).resolves.toBe(true);
	});

	it('answers disabled for a tenant whose tenant-wide toggle is disabled', async () => {
		actingIn(TENANT);
		const service = createService(CATALOGUE, [toggle(ORDER_FEATURE_ID, false)]);

		// the catalogue row for this code loads with `isEnabled: true`; the stored toggle overrules it
		await expect(service.isFeatureEnabled(ORDER)).resolves.toBe(false);
	});

	it('lets an organization toggle enable what the tenant-wide toggle disabled', async () => {
		actingIn(TENANT, ORGANIZATION);
		const service = createService(CATALOGUE, [
			toggle(WAREHOUSE_FEATURE_ID, false),
			toggle(WAREHOUSE_FEATURE_ID, true, ORGANIZATION)
		]);

		await expect(service.isFeatureEnabled(WAREHOUSE)).resolves.toBe(true);
	});

	it('lets an organization toggle disable what the tenant-wide toggle enabled', async () => {
		actingIn(TENANT, ORGANIZATION);
		const service = createService(CATALOGUE, [
			toggle(ORDER_FEATURE_ID, true),
			toggle(ORDER_FEATURE_ID, false, ORGANIZATION)
		]);

		await expect(service.isFeatureEnabled(ORDER)).resolves.toBe(false);
	});

	it('applies the tenant-wide toggle to an organization that has no row of its own', async () => {
		actingIn(TENANT, OTHER_ORGANIZATION);
		const service = createService(CATALOGUE, [
			toggle(WAREHOUSE_FEATURE_ID, true),
			toggle(WAREHOUSE_FEATURE_ID, false, ORGANIZATION)
		]);

		// the other organization's row is not this organization's answer
		await expect(service.isFeatureEnabled(WAREHOUSE)).resolves.toBe(true);
	});

	it('applies the tenant-wide toggle when the caller is in no organization', async () => {
		actingIn(TENANT);
		const service = createService(CATALOGUE, [
			toggle(WAREHOUSE_FEATURE_ID, true),
			toggle(WAREHOUSE_FEATURE_ID, false, ORGANIZATION)
		]);

		await expect(service.isFeatureEnabled(WAREHOUSE)).resolves.toBe(true);
	});

	it('ignores toggles stored for another tenant, another organization and another code', async () => {
		actingIn(TENANT, OTHER_ORGANIZATION);
		const service = createService(CATALOGUE, [
			toggle(WAREHOUSE_FEATURE_ID, true, null, OTHER_TENANT),
			toggle(WAREHOUSE_FEATURE_ID, true, ORGANIZATION),
			toggle(ORDER_FEATURE_ID, true)
		]);

		// nothing stored applies to this tenant, this organization and this code
		await expect(service.isFeatureEnabled(WAREHOUSE)).resolves.toBe(false);
	});

	it('falls back to the deployment configuration when the tenant has no toggle row', async () => {
		actingIn(TENANT);
		const service = createService(CATALOGUE, []);

		// nobody has switched this code, so the configured answer stands — and for a code the
		// configuration does not name that answer is `false`, whatever the catalogue marks it
		await expect(service.isFeatureEnabled(ORDER)).resolves.toBe(false);
	});

	it('falls back to the deployment configuration when the code has no catalogue row at all', async () => {
		actingIn(TENANT);
		const service = createService(CATALOGUE, []);

		// the read misses exactly as it always did — and the configured answer is what it returns,
		// which is `true` for this code
		expect(gauzyToggleFeatures[FeatureEnum.FEATURE_DOCUMENTS]).toBe(true);
		await expect(service.isFeatureEnabled(FeatureEnum.FEATURE_DOCUMENTS)).resolves.toBe(true);
	});

	it('answers from the deployment configuration, without raising, when the resolution carries no request context', async () => {
		// no scope is stubbed: this is a route or a job that never entered a request, where
		// `RequestContext.currentTenantId()` answers `null`
		const catalogue = createTypeOrmFeatureRepository(CATALOGUE);
		const toggles = createTypeOrmToggleRepository([toggle(WAREHOUSE_FEATURE_ID, true)]);
		const service = new FeatureService(
			catalogue as any,
			createMikroOrmFeatureRepository(CATALOGUE) as any,
			toggles as any,
			createMikroOrmToggleRepository([]) as any
		);

		await expect(service.isFeatureEnabled(WAREHOUSE)).resolves.toBe(false);
		// no scope was read, so no stored toggle could have answered
		expect(catalogue.findOneBy).not.toHaveBeenCalled();
		expect(toggles.find).not.toHaveBeenCalled();
	});

	it('answers from the deployment configuration when the scope cannot be read at all', async () => {
		jest.spyOn(RequestContext, 'currentTenantId').mockImplementation(() => {
			throw new Error('no request context');
		});
		const service = createService(CATALOGUE, [toggle(WAREHOUSE_FEATURE_ID, true)]);

		await expect(service.isFeatureEnabled(WAREHOUSE)).resolves.toBe(false);
	});

	it('answers from the deployment configuration when the catalogue cannot be read', async () => {
		actingIn(TENANT);
		const catalogue = {
			findOneBy: jest.fn(async () => {
				throw new Error('the catalogue is unreachable');
			})
		};
		const service = new FeatureService(
			catalogue as any,
			createMikroOrmFeatureRepository(CATALOGUE) as any,
			createTypeOrmToggleRepository([toggle(WAREHOUSE_FEATURE_ID, true)]) as any,
			createMikroOrmToggleRepository([]) as any
		);

		await expect(service.isFeatureEnabled(WAREHOUSE)).resolves.toBe(false);
	});
});

describe('the six capabilities a seeded catalogue row left switched off', () => {
	/** The codes whose REST surfaces answered 404 while their toggle rows said enabled. */
	const CAPABILITY_CODES = [
		'FEATURE_WAREHOUSE',
		'FEATURE_RETURNS',
		'FEATURE_SUBSCRIPTION',
		'FEATURE_PURCHASING',
		'FEATURE_ENTITLEMENT',
		'FEATURE_SEARCH'
	];

	afterEach(() => jest.restoreAllMocks());

	it('are codes the deployment configuration does not name', () => {
		CAPABILITY_CODES.forEach((code) => expect(gauzyToggleFeatures[code]).toBeUndefined());
	});

	it.each(CAPABILITY_CODES)('resolves %s as enabled once its tenant toggle is enabled', async (code) => {
		actingIn(TENANT);
		const featureId = `feature-uuid-${code}`;
		const service = createService([{ id: featureId, code, name: code }], [toggle(featureId, true)]);

		await expect(service.isFeatureEnabled(commerceCode(code))).resolves.toBe(true);
	});

	it.each(CAPABILITY_CODES)('resolves %s as disabled while no toggle row exists', async (code) => {
		actingIn(TENANT);
		const featureId = `feature-uuid-${code}`;
		const service = createService([{ id: featureId, code, name: code }], []);

		await expect(service.isFeatureEnabled(commerceCode(code))).resolves.toBe(false);
	});
});
