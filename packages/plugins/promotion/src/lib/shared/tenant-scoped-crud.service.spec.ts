import { NotFoundException } from '@nestjs/common';
import { MultiORM, RequestContext } from '@gauzy/core';
import { PromotionService } from '../promotion/promotion.service';
import { PromotionController } from '../promotion/promotion.controller';
import { PromotionResolver } from '../graphql/resolvers/promotion.resolver';
import { TenantScopedCrudService } from './tenant-scoped-crud.service';

/**
 * The withdraw/restore pair, on the base every service of this package extends — and on both ORMs.
 *
 * `softRemove` and `softRecover` are inherited from `CrudService`, and both resolve the row they act on
 * through `findOneByIdString`, which matches the identifier and nothing else. Nine services extend
 * `TenantScopedCrudService`, the inherited `DELETE /:id/soft` and `PUT /:id/recover` routes of all nine
 * controllers reach the pair, and so do the sixteen `softDelete<Resource>` / `recover<Resource>` fields:
 * a caller holding `PROMOTIONS_DELETE` in tenant A withdrew or restored tenant B's promotion by naming
 * its id, and was answered with the foreign row.
 *
 * **The kernel's own `CrudService` is under test**, not a double of it: the defect lived in the base's
 * two ORM branches, so the branches are what run. What is doubled is the storage — one TypeORM
 * repository and one MikroORM repository over the same rows, each honouring the `where` it is handed
 * and hiding withdrawn rows unless asked for them, so a read that forgot a condition matches a row it
 * should not rather than passing on a double that answered everything.
 *
 * The cases run once per ORM, because `DB_ORM` selects the branch at runtime and a fix proven on one of
 * them is not a fix. The last block drives the real `PromotionService` through the real controller and
 * the real resolver, so the two surfaces the finding named are measured rather than inferred.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_TENANT = '00000000-0000-4000-8000-000000000003';
const OTHER_ORG = '00000000-0000-4000-8000-000000000004';

/** The caller's own row. */
const OWN = '00000000-0000-4000-8000-0000000000a1';
/** A row of another tenant. */
const FOREIGN_TENANT = '00000000-0000-4000-8000-0000000000a2';
/** A row of the caller's tenant, in an organization the caller is not working in. */
const FOREIGN_ORG = '00000000-0000-4000-8000-0000000000a3';

const WITHDRAWN_AT = new Date('2026-03-01T00:00:00.000Z');

type Row = Record<string, any>;

/**
 * One stored row.
 *
 * It carries the two members MikroORM's `wrap()` reaches for on a managed entity — `assign`, which the
 * recovery writes `deletedAt: null` through, and `toJSON`, which the base serialises every answer
 * through — so the MikroORM branch runs its own code rather than a shortcut around it.
 */
function row(id: string, tenantId: string, organizationId: string, deletedAt: Date | null = null): Row {
	const stored: Row = { id, tenantId, organizationId, deletedAt };

	Object.defineProperties(stored, {
		__baseEntity: { value: true, enumerable: false },
		assign: {
			value(changes: Row) {
				Object.assign(stored, changes);

				return stored;
			},
			enumerable: false
		},
		toJSON: {
			value() {
				return { ...stored };
			},
			enumerable: false
		}
	});

	return stored;
}

/** The subset of conditions the base states, matched the way the database would. */
function matches(stored: Row, where: Row = {}): boolean {
	return Object.entries(where).every(([field, expected]) => expected === undefined || stored[field] === expected);
}

/**
 * The two repositories over one table.
 *
 * Both hide a withdrawn row unless the read asks for it — TypeORM through `withDeleted`, MikroORM through
 * the soft-delete filter being switched off — because that is what the recovery's own `withDeleted`
 * exists to lift, and a double that showed every row would let a recovery that forgot it pass.
 *
 * @param rows The table.
 * @returns The two repositories, and the log of every write they received.
 */
function storage(rows: Row[]) {
	const writes: Array<{ orm: MultiORM; op: string; id: string }> = [];
	const visible = (withDeleted: boolean) => rows.filter((stored) => withDeleted || !stored.deletedAt);

	const typeOrm = {
		metadata: undefined,
		findOne: async (options: { where?: Row; withDeleted?: boolean }) =>
			visible(Boolean(options?.withDeleted)).find((stored) => matches(stored, options?.where)) ?? null,
		findOneOrFail: async (options: { where?: Row; withDeleted?: boolean }) => {
			const found = visible(Boolean(options?.withDeleted)).find((stored) => matches(stored, options?.where));

			if (!found) {
				throw new Error('EntityNotFoundError');
			}

			return found;
		},
		softRemove: async (entity: Row) => {
			writes.push({ orm: 'typeorm', op: 'softRemove', id: entity.id });
			entity.deletedAt = WITHDRAWN_AT;

			return entity;
		},
		recover: async (entity: Row) => {
			writes.push({ orm: 'typeorm', op: 'recover', id: entity.id });
			entity.deletedAt = null;

			return entity;
		}
	};

	const mikroOrm = {
		findOne: async (where: Row, options?: { filters?: Record<string, boolean> }) => {
			const withDeleted = Object.values(options?.filters ?? {}).some((enabled) => enabled === false);

			return visible(withDeleted).find((stored) => matches(stored, where)) ?? null;
		},
		// MikroORM soft-deletes through the platform's soft-delete handling on `remove`, which is what the
		// base relies on; the double does what that handling does to the row.
		removeAndFlush: async (entity: Row) => {
			writes.push({ orm: 'mikro-orm', op: 'removeAndFlush', id: entity.id });
			entity.deletedAt = WITHDRAWN_AT;
		},
		persistAndFlush: async (entity: Row) => {
			writes.push({ orm: 'mikro-orm', op: 'persistAndFlush', id: entity.id });
		}
	};

	return { typeOrm, mikroOrm, writes };
}

/** A service of this package's shape, with the ORM branch chosen by the case rather than by `DB_ORM`. */
class ScopedRowService extends TenantScopedCrudService<any> {
	constructor(typeOrm: any, mikroOrm: any, private readonly orm: MultiORM) {
		super(typeOrm, mikroOrm);
	}

	get ormType(): MultiORM {
		return this.orm;
	}
}

/** The three rows every case starts from: the caller's, another tenant's and a sibling organization's. */
function table(deletedAt: Date | null = null): Row[] {
	return [
		row(OWN, TENANT, ORG, deletedAt),
		row(FOREIGN_TENANT, OTHER_TENANT, OTHER_ORG, deletedAt),
		row(FOREIGN_ORG, TENANT, OTHER_ORG, deletedAt)
	];
}

function find(rows: Row[], id: string): Row {
	return rows.find((stored) => stored.id === id) as Row;
}

describe.each<MultiORM>(['typeorm', 'mikro-orm'])('TenantScopedCrudService on %s — withdraw and restore', (orm) => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses to withdraw another tenant’s row, and writes nothing', async () => {
		const rows = table();
		const { typeOrm, mikroOrm, writes } = storage(rows);
		const service = new ScopedRowService(typeOrm, mikroOrm, orm);

		await expect(service.softRemove(FOREIGN_TENANT)).rejects.toBeInstanceOf(NotFoundException);

		expect(find(rows, FOREIGN_TENANT).deletedAt).toBeNull();
		expect(writes).toEqual([]);
	});

	it('refuses to withdraw a row of a sibling organization of the caller’s own tenant', async () => {
		// The organization is part of the read scope: every hand-written read of these services states
		// `{ tenantId, organizationId }`, so a withdrawal that reached further would act on a row no read
		// of this package would show the caller.
		const rows = table();
		const { typeOrm, mikroOrm, writes } = storage(rows);
		const service = new ScopedRowService(typeOrm, mikroOrm, orm);

		await expect(service.softRemove(FOREIGN_ORG)).rejects.toBeInstanceOf(NotFoundException);

		expect(find(rows, FOREIGN_ORG).deletedAt).toBeNull();
		expect(writes).toEqual([]);
	});

	it('refuses the foreign row when the options arrive as the inherited route hands them over', async () => {
		// `CrudController.softRemove` forwards its rest parameter — an array — as the find options. The
		// base reads an array as "no options"; the scope must still travel.
		const rows = table();
		const { typeOrm, mikroOrm, writes } = storage(rows);
		const service = new ScopedRowService(typeOrm, mikroOrm, orm);

		await expect(service.softRemove(FOREIGN_TENANT, [] as any)).rejects.toBeInstanceOf(NotFoundException);

		expect(writes).toEqual([]);
	});

	it('narrows a where that names another tenant back to the caller’s, rather than widening the read', async () => {
		const rows = table();
		const { typeOrm, mikroOrm, writes } = storage(rows);
		const service = new ScopedRowService(typeOrm, mikroOrm, orm);

		await expect(
			service.softRemove(FOREIGN_TENANT, { where: { tenantId: OTHER_TENANT, organizationId: OTHER_ORG } } as any)
		).rejects.toBeInstanceOf(NotFoundException);

		expect(writes).toEqual([]);
	});

	it('withdraws the caller’s own row', async () => {
		const rows = table();
		const { typeOrm, mikroOrm, writes } = storage(rows);
		const service = new ScopedRowService(typeOrm, mikroOrm, orm);

		const withdrawn = await service.softRemove(OWN, [] as any);

		expect(withdrawn).toMatchObject({ id: OWN, tenantId: TENANT, organizationId: ORG });
		expect(find(rows, OWN).deletedAt).toEqual(WITHDRAWN_AT);
		expect(writes.map(({ id }) => id)).toEqual([OWN]);
	});

	it('refuses to restore another tenant’s withdrawn row, and leaves it withdrawn', async () => {
		const rows = table(WITHDRAWN_AT);
		const { typeOrm, mikroOrm, writes } = storage(rows);
		const service = new ScopedRowService(typeOrm, mikroOrm, orm);

		await expect(service.softRecover(FOREIGN_TENANT)).rejects.toBeInstanceOf(NotFoundException);
		await expect(service.softRecover(FOREIGN_ORG, [] as any)).rejects.toBeInstanceOf(NotFoundException);

		expect(find(rows, FOREIGN_TENANT).deletedAt).toEqual(WITHDRAWN_AT);
		expect(find(rows, FOREIGN_ORG).deletedAt).toEqual(WITHDRAWN_AT);
		expect(writes).toEqual([]);
	});

	it('restores the caller’s own withdrawn row, which only a read with the withdrawn rows can find', async () => {
		const rows = table(WITHDRAWN_AT);
		const { typeOrm, mikroOrm } = storage(rows);
		const service = new ScopedRowService(typeOrm, mikroOrm, orm);

		const restored = await service.softRecover(OWN, [] as any);

		expect(restored).toMatchObject({ id: OWN, tenantId: TENANT, organizationId: ORG });
		expect(find(rows, OWN).deletedAt).toBeNull();
	});

	it('answers a read by identifier of a foreign row as missing, on the raising and the fail-soft read', async () => {
		const rows = table();
		const { typeOrm, mikroOrm } = storage(rows);
		const service = new ScopedRowService(typeOrm, mikroOrm, orm);

		await expect(service.findOneByIdString(FOREIGN_TENANT)).rejects.toBeInstanceOf(NotFoundException);
		await expect(service.findOneByIdString(OWN)).resolves.toMatchObject({ id: OWN });

		// The fail-soft read goes through the repository's raising lookup on both branches; the MikroORM
		// double has none, so the TypeORM branch is the one this pair measures.
		if (orm === 'typeorm') {
			expect((await service.findOneOrFailByIdString(FOREIGN_TENANT)).success).toBe(false);
			expect((await service.findOneOrFailByIdString(OWN)).success).toBe(true);
		}
	});
});

describe('TenantScopedCrudService — a write with no caller in context', () => {
	afterEach(() => jest.restoreAllMocks());

	it('is not narrowed by a scope nobody stated, so a job still reaches the row it names', async () => {
		// The same rule `writeScope` states: a seeder or a job has no tenant to be scoped by, and a
		// condition on an absent tenant would match nothing on one ORM and everything on the other.
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(null as any);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(null as any);

		const rows = table();
		const { typeOrm, mikroOrm } = storage(rows);
		const service = new ScopedRowService(typeOrm, mikroOrm, 'typeorm');

		await service.softRemove(FOREIGN_TENANT);

		expect(find(rows, FOREIGN_TENANT).deletedAt).toEqual(WITHDRAWN_AT);
	});
});

/**
 * The real `PromotionService`, through the real route and the real field.
 *
 * The finding named `softDeletePromotion` / `recoverPromotion` and the inherited REST pair; both are
 * driven here against a foreign tenant's promotion, on both ORMs. The service's other collaborators are
 * never reached by the pair, so they are empty doubles.
 */
describe.each<MultiORM>(['typeorm', 'mikro-orm'])('PromotionService on %s — a foreign tenant’s promotion', (orm) => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	/** The real service over the doubled storage, with the branch the case names. */
	function promotions(rows: Row[]) {
		const { typeOrm, mikroOrm, writes } = storage(rows);
		const service = new PromotionService(
			typeOrm as never,
			mikroOrm as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never
		);

		Object.defineProperty(service, 'ormType', { get: () => orm });

		return {
			writes,
			service,
			controller: new PromotionController(service),
			resolver: new PromotionResolver(service, {} as never, {} as never, {} as never, {} as never, {} as never)
		};
	}

	it('is neither withdrawn nor restored over REST, and the route answers 404', async () => {
		const live = table();
		const surfaces = promotions(live);

		await expect(surfaces.controller.softRemove(FOREIGN_TENANT)).rejects.toBeInstanceOf(NotFoundException);
		expect(find(live, FOREIGN_TENANT).deletedAt).toBeNull();

		const withdrawn = table(WITHDRAWN_AT);
		const restoring = promotions(withdrawn);

		await expect(restoring.controller.softRecover(FOREIGN_TENANT)).rejects.toBeInstanceOf(NotFoundException);
		expect(find(withdrawn, FOREIGN_TENANT).deletedAt).toEqual(WITHDRAWN_AT);
		expect([...surfaces.writes, ...restoring.writes]).toEqual([]);
	});

	it('is neither withdrawn nor restored over GraphQL, and the payload carries no foreign row', async () => {
		const live = table();
		const surfaces = promotions(live);

		const removal = await surfaces.resolver.softDeletePromotion(FOREIGN_TENANT);

		expect(removal.promotion).toBeNull();
		expect(removal.userErrors).toHaveLength(1);
		expect(find(live, FOREIGN_TENANT).deletedAt).toBeNull();

		const withdrawn = table(WITHDRAWN_AT);
		const restoring = promotions(withdrawn);

		const recovery = await restoring.resolver.recoverPromotion(FOREIGN_TENANT);

		expect(recovery.promotion).toBeNull();
		expect(recovery.userErrors).toHaveLength(1);
		expect(find(withdrawn, FOREIGN_TENANT).deletedAt).toEqual(WITHDRAWN_AT);
		expect([...surfaces.writes, ...restoring.writes]).toEqual([]);
	});

	it('still withdraws and restores the caller’s own promotion on both surfaces', async () => {
		const rows = table();
		const { controller, resolver } = promotions(rows);

		await controller.softRemove(OWN);
		expect(find(rows, OWN).deletedAt).toEqual(WITHDRAWN_AT);

		const recovery = await resolver.recoverPromotion(OWN);

		expect(recovery.userErrors).toEqual([]);
		expect(recovery.promotion).toMatchObject({ id: OWN });
		expect(find(rows, OWN).deletedAt).toBeNull();
	});
});
