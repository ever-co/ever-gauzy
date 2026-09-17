/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a set of shipping profiles needs and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary,
 * exactly as the sibling packages' service specs do, and **the services under test are the real
 * ones**: the profile service, and the real `ShippingProfileVariantService` it attaches variants
 * through, so the reassignment below is exercised rather than imitated.
 *
 * The base-class double mirrors `CrudService` / `TenantAwareCrudService` where the behaviour is
 * observable to a caller — `findAll` answers `{ items, total }`, `update` loads the row first and then
 * answers TypeORM's `UpdateResult`, and a lookup that matches nothing **raises `NotFoundException`**
 * rather than answering `null` (`packages/core/src/lib/core/crud/crud.service.ts`, the `if (!record)`
 * branch of `findOneByWhereOptions` on line 465). One of the cases below turns on exactly that.
 *
 * What the double does not model is the tenancy the real base class injects into every read
 * (`findOneWithTenant`), so the cases here state tenancy-scoped behaviour only where the service
 * states the scope itself. Nothing in this service does: the organization is added by the base class,
 * and a suite that pretended otherwise would be asserting the double.
 */
jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		get ormType(): string {
			return 'typeorm';
		}

		async findAll(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
		}

		async find(options: any = {}): Promise<any> {
			return this.typeOrmRepository.find(options);
		}

		async paginate(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
		}

		async findOneByIdString(id: any, options: any = {}): Promise<any> {
			if (!id) {
				throw new NotFoundException('The requested record was not found');
			}

			const record = await this.typeOrmRepository.findOne({
				...options,
				where: { ...(options.where ?? {}), id }
			});

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
		}

		async findOneByWhereOptions(where: any): Promise<any> {
			const record = await this.typeOrmRepository.findOneBy(where);

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
		}

		async create(entity: any): Promise<any> {
			return this.typeOrmRepository.save(this.typeOrmRepository.create(entity));
		}

		async update(id: any, partial: any): Promise<any> {
			if (typeof id === 'string') {
				await this.findOneByIdString(id);
			}

			return this.typeOrmRepository.update(id, partial);
		}

		async delete(criteria: any): Promise<any> {
			return this.typeOrmRepository.delete(criteria);
		}
	}

	return {
		TenantAwareCrudService,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		BaseEvent: class {},
		EventBus: class {},
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

import { NotFoundException } from '@nestjs/common';
import { ShippingProfileVariant } from '../shipping-profile-variant/shipping-profile-variant.entity';
import { ShippingProfileVariantService } from '../shipping-profile-variant/shipping-profile-variant.service';
import { ShippingProfileService } from './shipping-profile.service';

/**
 * The sets of variants that ship the same way.
 *
 * A profile is what makes "this cart is only digital goods, do not offer a courier" expressible, and
 * the two invariants it owns are both unenforceable by a plain unique constraint, which is why they
 * live in the service (doc 09 §12.1):
 *
 * - **at most one default profile per organization**, so that a variant's shipping behaviour never
 *   depends on row order; promoting a profile demotes whatever held the flag, and the profile being
 *   promoted is never demoted by its own promotion;
 * - **a variant belongs to at most one profile**: attaching a variant that another profile already
 *   holds *moves* the attachment rather than writing a second row, which the migration expresses as a
 *   unique index on `variantId` alone (`UQ_shipping_profile_variant_one`);
 * - a profile code is unique inside the organization (`UQ_shipping_profile_org_code`);
 * - resolution for a variant is the profile it is attached to, then the organization's default, then
 *   nothing — a variant that has neither is answered `null` rather than guessed at, because the
 *   synthetic default the platform seeds is the seed's business (doc 09 §12.1).
 *
 * The services are constructed directly with an in-memory double of each table's repository, and the
 * pivot service is the real one over the same store, so a reassignment is a real delete followed by a
 * real insert.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const COLD = '00000000-0000-4000-8000-0000000000f1';
const BULK = '00000000-0000-4000-8000-0000000000f2';
const DIGITAL = '00000000-0000-4000-8000-0000000000f3';
const VARIANT_A = '00000000-0000-4000-8000-0000000000a1';
const VARIANT_B = '00000000-0000-4000-8000-0000000000b1';
const VARIANT_C = '00000000-0000-4000-8000-0000000000c1';
const UNKNOWN = '00000000-0000-4000-8000-0000000000ff';

type Row = Record<string, any>;

/** The tables this suite drives, as plain arrays. */
interface ITables {
	shipping_profile: Row[];
	shipping_profile_variant: Row[];
}

/**
 * An in-memory stand-in for one table's TypeORM repository.
 *
 * @param tables The whole datastore.
 * @param tableName The table this repository writes.
 */
function repository(tables: ITables, tableName: keyof ITables) {
	let sequence = 0;
	const rows = () => tables[tableName];
	const same = (left: unknown, right: unknown) => String(left ?? '') === String(right ?? '');
	const matches = (row: Row, where: Row = {}): boolean =>
		Object.entries(where).every(([field, expected]) => {
			// TypeORM drops an `undefined` member from the condition rather than matching nothing.
			if (expected === undefined) {
				return true;
			}

			return same(row[field], expected);
		});

	return {
		rows,
		metadata: { tableName, hasColumnWithPropertyPath: () => false },
		find: async (options: Row = {}) => rows().filter((row) => matches(row, options.where)),
		findOne: async (options: Row = {}) => rows().find((row) => matches(row, options.where)) ?? null,
		findOneBy: async (where: Row) => rows().find((row) => matches(row, where)) ?? null,
		findAndCount: async (options: Row = {}) => {
			const items = rows().filter((row) => matches(row, options.where));

			return [items, items.length];
		},
		count: async () => rows().length,
		create: (partial: Row) => ({ ...partial }),
		save: async (entity: Row) => {
			if (entity.id) {
				const index = rows().findIndex((row) => same(row.id, entity.id));

				if (index >= 0) {
					rows()[index] = { ...rows()[index], ...entity };

					return rows()[index];
				}
			}

			// The table's own defaults, as the migration declares them.
			const created = { id: `${String(tableName)}-new-${++sequence}`, isDefault: false, ...entity };

			rows().push(created);

			return created;
		},
		// The platform's `update` reaches TypeORM's own, which answers an `UpdateResult` and not the row.
		update: async (criteria: any, partial: Row) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = rows().findIndex((row) => same(row.id, id));

			if (index >= 0) {
				Object.assign(rows()[index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		delete: async (criteria: any) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = rows().findIndex((row) => same(row.id, id));

			if (index >= 0) {
				rows().splice(index, 1);
			}

			return { affected: index >= 0 ? 1 : 0 };
		}
	};
}

/** One `shipping_profile` row. */
const profile = (id: string, overrides: Row = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	name: `Profile ${id}`,
	code: id.toUpperCase(),
	isDefault: false,
	...overrides
});

/** One `shipping_profile_variant` attachment row. */
const attachment = (id: string, profileId: string, variantId: string, overrides: Row = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	profileId,
	variantId,
	...overrides
});

/**
 * Builds the profile service over one in-memory datastore, with the real pivot service over the
 * `shipping_profile_variant` table.
 *
 * @param seed The profiles and attachments the fixture starts with.
 */
function profileFixture(seed: { shipping_profile?: Row[]; shipping_profile_variant?: Row[] } = {}) {
	const tables: ITables = {
		shipping_profile: [...(seed.shipping_profile ?? [])],
		shipping_profile_variant: [...(seed.shipping_profile_variant ?? [])]
	};
	const pivotService = new ShippingProfileVariantService(
		repository(tables, 'shipping_profile_variant') as never,
		{} as never
	);
	const service = new ShippingProfileService(
		repository(tables, 'shipping_profile') as never,
		{} as never,
		pivotService
	);

	return {
		service,
		pivotService,
		tables,
		row: (id: string) => tables.shipping_profile.find((row) => row.id === id),
		byCode: (code: string) => tables.shipping_profile.find((row) => row.code === code),
		defaults: () => tables.shipping_profile.filter((row) => row.isDefault),
		attachments: (variantId: string) =>
			tables.shipping_profile_variant.filter((row) => row.variantId === variantId)
	};
}

describe('ShippingProfileService — the code a profile claims (doc 09 §12.1)', () => {
	it('refuses a profile that states no code', async () => {
		const fixture = profileFixture();

		await expect(fixture.service.create({ name: 'Untitled' } as never)).rejects.toThrow(
			/SHIPPING_PROFILE_CODE_REQUIRED/
		);
		expect(fixture.tables.shipping_profile).toEqual([]);
	});

	it('refuses a code another profile of the organization already holds', async () => {
		const fixture = profileFixture({ shipping_profile: [profile('standard', { code: 'STANDARD' })] });

		await expect(fixture.service.create({ name: 'Standard', code: 'STANDARD' } as never)).rejects.toMatchObject({
			response: {
				code: 'SHIPPING_PROFILE_CODE_TAKEN',
				details: { code: 'STANDARD', profileId: 'standard' }
			}
		});
		expect(fixture.tables.shipping_profile).toHaveLength(1);
	});

	it('accepts an edit that keeps the profile’s own code', async () => {
		// The guard excludes the row being written, so an edit that re-states a code beside another
		// change cannot collide with itself.
		const fixture = profileFixture({ shipping_profile: [profile('standard', { code: 'STANDARD' })] });

		await fixture.service.update('standard', { code: 'STANDARD', name: 'Standard shipping' } as never);

		expect(fixture.row('standard')).toMatchObject({ code: 'STANDARD', name: 'Standard shipping' });
	});

	it('refuses an edit that claims another profile’s code', async () => {
		const fixture = profileFixture({
			shipping_profile: [profile('standard', { code: 'STANDARD' }), profile('cold', { code: 'COLD' })]
		});

		await expect(fixture.service.update('standard', { code: 'COLD' } as never)).rejects.toMatchObject({
			response: { code: 'SHIPPING_PROFILE_CODE_TAKEN', details: { code: 'COLD', profileId: 'cold' } }
		});
		expect(fixture.row('standard')).toMatchObject({ code: 'STANDARD' });
	});

	it('refuses an edit on a profile that does not exist', async () => {
		const fixture = profileFixture();

		await expect(fixture.service.update(UNKNOWN, { name: 'Nowhere' } as never)).rejects.toBeInstanceOf(
			NotFoundException
		);
	});

	// The defect: `assertCodeIsFree` reads a missing row through `findOneByWhereOptions`
	// (`shipping-profile.service.ts`, line 147, reached from `create` on line 40 and from `update` on
	// line 58) and treats a miss as `null` — but the platform's CRUD base *throws* `NotFoundException`
	// when nothing matches (`packages/core/src/lib/core/crud/crud.service.ts`, lines 465–467, under a
	// doc comment that still claims it answers null). A profile whose code is free therefore raises a
	// 404 and writes nothing: `shipping_profile` can never be populated through this service, and no
	// profile can be re-coded, so the whole shipping configuration is unreachable from the API.
	it.failing('[DEFECT] creates a profile whose code no other profile holds', async () => {
		const fixture = profileFixture();

		const created = await fixture.service.create({ name: 'Standard', code: 'STANDARD' } as never);

		expect(created).toMatchObject({ name: 'Standard', code: 'STANDARD', isDefault: false });
		expect(fixture.byCode('STANDARD')).toBeDefined();
		expect(fixture.tables.shipping_profile).toHaveLength(1);
	});

	it.failing('[DEFECT] accepts an edit that gives a profile a code no other profile holds', async () => {
		const fixture = profileFixture({ shipping_profile: [profile('standard', { code: 'STANDARD' })] });

		await fixture.service.update('standard', { code: 'GROUND' } as never);

		expect(fixture.row('standard')).toMatchObject({ code: 'GROUND' });
	});
});

describe('ShippingProfileService — one default profile per organization (doc 09 §12.1)', () => {
	it('promotes a profile to default and demotes the one that held it', async () => {
		// Two defaults would make a variant's shipping behaviour depend on row order, so the promotion
		// and the demotion happen together.
		const fixture = profileFixture({
			shipping_profile: [profile('standard', { isDefault: true }), profile('cold')]
		});

		await fixture.service.update('cold', { isDefault: true } as never);

		expect(fixture.row('cold')).toMatchObject({ isDefault: true });
		expect(fixture.row('standard')).toMatchObject({ isDefault: false });
		expect(fixture.defaults()).toHaveLength(1);
		expect(fixture.tables.shipping_profile).toHaveLength(2);
	});

	it('leaves the profile being promoted alone when it already holds the flag', async () => {
		// The demotion excludes the row being written: a profile promoted to the flag it already holds
		// must not demote itself on the way.
		const fixture = profileFixture({ shipping_profile: [profile('standard', { isDefault: true })] });

		await fixture.service.update('standard', { isDefault: true, name: 'Standard shipping' } as never);

		expect(fixture.row('standard')).toMatchObject({ isDefault: true, name: 'Standard shipping' });
		expect(fixture.defaults()).toHaveLength(1);
	});

	it('brings a store that holds two defaults back to one', async () => {
		// The invariant is evaluated over every profile rather than over the first match, so data that
		// predates the rule — or a fixture that made one — is repaired by the next promotion.
		const fixture = profileFixture({
			shipping_profile: [profile('one', { isDefault: true }), profile('two', { isDefault: true }), profile('cold')]
		});

		await fixture.service.update('cold', { isDefault: true } as never);

		expect(fixture.defaults().map((row) => row.id)).toEqual(['cold']);
	});

	it('leaves the default alone when an edit does not mention it', async () => {
		const fixture = profileFixture({
			shipping_profile: [profile('standard', { isDefault: true }), profile('cold')]
		});

		await fixture.service.update('cold', { name: 'Cold chain' } as never);

		expect(fixture.row('standard')).toMatchObject({ isDefault: true });
		expect(fixture.defaults()).toHaveLength(1);
	});

	it('lets an organization hold no default at all, rather than promoting a replacement', async () => {
		// Clearing the flag is a legal edit — a variant with no attachment then resolves to nothing
		// instead of to a profile nobody chose — and the service does not elect a new default itself.
		const fixture = profileFixture({
			shipping_profile: [profile('standard', { isDefault: true }), profile('cold')]
		});

		await fixture.service.update('standard', { isDefault: false } as never);

		expect(fixture.defaults()).toEqual([]);
		expect(fixture.row('cold')).toMatchObject({ isDefault: false });
	});
});

describe('ShippingProfileService — which profile a variant ships under (doc 09 §12.1)', () => {
	it('answers the profile a variant is attached to, even when another profile is the default', async () => {
		// The attachment is the explicit answer and wins over the fallback: that is the whole point of
		// attaching a variant rather than promoting a profile.
		const fixture = profileFixture({
			shipping_profile: [profile('standard', { isDefault: true }), profile('cold')],
			shipping_profile_variant: [attachment('link-a', 'cold', VARIANT_A)]
		});

		expect((await fixture.service.resolveForVariant(VARIANT_A))?.id).toBe('cold');
	});

	it('answers the organization’s default for a variant that is attached to nothing', async () => {
		const fixture = profileFixture({
			shipping_profile: [profile('standard', { isDefault: true }), profile('cold')]
		});

		expect((await fixture.service.resolveForVariant(VARIANT_B))?.id).toBe('standard');
	});

	it('answers nothing for a variant that has neither an attachment nor a default', async () => {
		// The service does not invent a profile: the synthetic default the platform seeds is the seed's
		// business, and a caller that gets `null` knows there is no shipping configuration to use.
		const fixture = profileFixture({ shipping_profile: [profile('cold')] });

		expect(await fixture.service.resolveForVariant(VARIANT_B)).toBeNull();
	});

	it('answers the first attachment when the store holds more than one for a variant', async () => {
		// The row order dependence the unique index exists to prevent
		// (`UQ_shipping_profile_variant_one` on `variantId` alone): the service reads the first
		// attachment, so the data it reads must hold at most one.
		const fixture = profileFixture({
			shipping_profile: [profile('cold'), profile('bulk')],
			shipping_profile_variant: [
				attachment('link-one', 'cold', VARIANT_C),
				attachment('link-two', 'bulk', VARIANT_C)
			]
		});

		expect((await fixture.service.resolveForVariant(VARIANT_C))?.id).toBe('cold');
	});

	it('refuses to resolve an attachment whose profile is not there', async () => {
		// The attachment is a row with a foreign key, so this is the state a cascade leaves behind only
		// if it was written outside the schema; the read fails closed rather than answering a profile
		// that does not exist.
		const fixture = profileFixture({
			shipping_profile: [profile('cold')],
			shipping_profile_variant: [attachment('link-a', 'deleted-profile', VARIANT_A)]
		});

		await expect(fixture.service.resolveForVariant(VARIANT_A)).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('ShippingProfileService — attaching variants to a profile (doc 09 §12.1)', () => {
	it('attaches the variants it is given and answers with what the profile holds afterwards', async () => {
		const fixture = profileFixture({ shipping_profile: [profile('cold')] });

		const attached = await fixture.service.assignVariants('cold', { add: [VARIANT_A, VARIANT_B] });

		expect(attached).toHaveLength(2);
		expect(attached.map((row) => row.variantId).sort()).toEqual([VARIANT_A, VARIANT_B].sort());
		expect(attached.every((row: ShippingProfileVariant) => row.profileId === 'cold')).toBe(true);
		expect(fixture.tables.shipping_profile_variant).toHaveLength(2);
	});

	it('moves a variant another profile already holds instead of writing a second attachment', async () => {
		// The invariant this service exists to hold: **a variant belongs to at most one profile**. A
		// second row would leave the variant with two shipping behaviours and the resolution above
		// depending on row order.
		const fixture = profileFixture({
			shipping_profile: [profile('cold'), profile('bulk')],
			shipping_profile_variant: [attachment('link-cold', 'cold', VARIANT_A)]
		});

		const attached = await fixture.service.assignVariants('bulk', { add: [VARIANT_A] });

		expect(attached).toHaveLength(1);
		expect(attached[0]).toMatchObject({ profileId: 'bulk', variantId: VARIANT_A });
		expect(fixture.attachments(VARIANT_A)).toHaveLength(1);
		expect(fixture.tables.shipping_profile_variant.some((row) => row.id === 'link-cold')).toBe(false);
		// And the variant now resolves to the profile it was moved to.
		expect((await fixture.service.resolveForVariant(VARIANT_A))?.id).toBe('bulk');
	});

	it('writes no second attachment when the variant is already on that profile', async () => {
		// Idempotence of the attach: submitting the same assignment twice leaves one row, because the
		// service asks what the variant already holds before it inserts.
		const fixture = profileFixture({
			shipping_profile: [profile('cold')],
			shipping_profile_variant: [attachment('link-cold', 'cold', VARIANT_A)]
		});

		await fixture.service.assignVariants('cold', { add: [VARIANT_A] });
		await fixture.service.assignVariants('cold', { add: [VARIANT_A] });

		expect(fixture.attachments(VARIANT_A)).toHaveLength(1);
		expect(fixture.attachments(VARIANT_A)[0].id).toBe('link-cold');
	});

	it('detaches the variants it is asked to remove and leaves the rest attached', async () => {
		const fixture = profileFixture({
			shipping_profile: [profile('cold')],
			shipping_profile_variant: [
				attachment('link-a', 'cold', VARIANT_A),
				attachment('link-b', 'cold', VARIANT_B),
				attachment('link-c', 'cold', VARIANT_C)
			]
		});

		const remaining = await fixture.service.assignVariants('cold', { remove: [VARIANT_B] });

		expect(remaining.map((row) => row.variantId).sort()).toEqual([VARIANT_A, VARIANT_C].sort());
		expect(fixture.attachments(VARIANT_B)).toEqual([]);
		// A detached variant falls back to the default rather than to the profile it left.
		expect(await fixture.service.resolveForVariant(VARIANT_B)).toBeNull();
	});

	it('applies removals before additions, so one call may re-attach a variant it also detaches', async () => {
		// The order the service states: the detach runs first, so a caller that names the same variant in
		// both lists ends with one attachment and not with a refusal or a duplicate.
		const fixture = profileFixture({
			shipping_profile: [profile('cold')],
			shipping_profile_variant: [attachment('link-a', 'cold', VARIANT_A)]
		});

		const attached = await fixture.service.assignVariants('cold', {
			add: [VARIANT_A],
			remove: [VARIANT_A]
		});

		expect(attached).toHaveLength(1);
		expect(fixture.attachments(VARIANT_A)).toHaveLength(1);
	});

	it('scopes a removal to the profile being edited and leaves another profile’s attachments alone', async () => {
		// Both halves of the change are scoped to the profile that was named: removing a variant detaches
		// it *from this profile* and does not detach it from the one it is actually attached to, and
		// adding one touches no other profile's rows.
		const fixture = profileFixture({
			shipping_profile: [profile('cold'), profile('bulk'), profile('digital')],
			shipping_profile_variant: [
				attachment('link-cold', 'cold', VARIANT_A),
				attachment('link-digital', 'digital', VARIANT_C)
			]
		});

		await fixture.service.assignVariants('bulk', { add: [VARIANT_B], remove: [VARIANT_A] });

		expect(fixture.attachments(VARIANT_A)).toHaveLength(1);
		expect(fixture.attachments(VARIANT_A)[0].profileId).toBe('cold');
		expect(fixture.attachments(VARIANT_C)).toHaveLength(1);
		expect(fixture.attachments(VARIANT_C)[0].profileId).toBe('digital');
		expect(fixture.attachments(VARIANT_B)[0].profileId).toBe('bulk');
		expect(fixture.tables.shipping_profile_variant).toHaveLength(3);
	});

	it('changes nothing for an empty change set', async () => {
		const fixture = profileFixture({
			shipping_profile: [profile('cold')],
			shipping_profile_variant: [attachment('link-a', 'cold', VARIANT_A)]
		});

		const attached = await fixture.service.assignVariants('cold', {});

		expect(attached).toHaveLength(1);
		expect(fixture.attachments(VARIANT_A)[0].id).toBe('link-a');
	});

	it('refuses an assignment on a profile that does not exist, before it touches any attachment', async () => {
		// The package's own `SHIPPING_PROFILE_NOT_FOUND` never reaches the caller: the CRUD base raises
		// the generic not-found for the missing profile first (`shipping-profile.service.ts`, the
		// `findOneByIdString` on line 99 and the branch under it, which the base class shadows). The
		// status a caller sees is the 404 either way, which is what this pins — and because the profile
		// is loaded before anything else, a refused call has no side effect: nothing was detached on the
		// way to the refusal.
		const fixture = profileFixture({
			shipping_profile: [profile('cold')],
			shipping_profile_variant: [attachment('link-a', 'cold', VARIANT_A)]
		});

		await expect(fixture.service.assignVariants(UNKNOWN, { remove: [VARIANT_A] })).rejects.toBeInstanceOf(
			NotFoundException
		);
		expect(fixture.attachments(VARIANT_A)).toHaveLength(1);
		expect(fixture.tables.shipping_profile_variant).toHaveLength(1);
	});
});
