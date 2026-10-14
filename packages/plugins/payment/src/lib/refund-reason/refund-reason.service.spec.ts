/**
 * `@gauzy/core` boots the whole application graph from its barrel — the configuration, the ORM, the job
 * registry, the module scanner — none of which a reason lookup needs and none of which is available
 * outside a running application. The seam is therefore doubled at the module boundary, exactly as the
 * catalogue and inventory packages' service specs do, and **the service under test is the real one**:
 * only the base CRUD class, the request context and the entity base classes are substituted.
 *
 * The base-class double mirrors the platform's `CrudService` where the behaviour is observable to a
 * caller, and that is both halves of the read pair: `findOneByWhereOptions` raises `NotFoundException`
 * for an absent row on both ORM branches (`crud.service.ts`, `findOneByWhereOptions`) rather than
 * answering the `null` its prose promises, while `findOneOrFailByWhereOptions` is the half a caller
 * uses when absence is an ordinary answer, reporting the miss as an `ITryRequest` carrying
 * `success: false`. `createReason` asks "is this code free?" through the second half, because a free
 * code is how every reason in the taxonomy started.
 */
jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	class CrudService {
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

		async findOneByWhereOptions(where: any): Promise<any> {
			const record = await this.typeOrmRepository.findOneBy(where);

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
		}

		async findOneOrFailByWhereOptions(where: any): Promise<any> {
			// Faithful to the platform: the same read, reporting the miss as a value rather than raising.
			const record = await this.typeOrmRepository.findOneBy(where);

			return record ? { success: true, record } : { success: false };
		}

		async create(entity: any): Promise<any> {
			return this.typeOrmRepository.save(this.typeOrmRepository.create(entity));
		}

		async update(id: any, partial: any): Promise<any> {
			return this.typeOrmRepository.update(id, partial);
		}

		async delete(criteria: any): Promise<any> {
			return this.typeOrmRepository.delete(criteria);
		}
	}

	return {
		CrudService,
		TenantAwareCrudService: CrudService,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		ExportRedacted: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		JsonArrayColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		BaseEvent: class {},
		EventBus: class {},
		Payment: class Payment {},
		Integration: class Integration {},
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
import { RequestContext } from '@gauzy/core';
import { RefundReasonService } from './refund-reason.service';

/**
 * The governed refund reasons (doc 05 §12.6, doc 10 §8.2).
 *
 * An operator-maintained lookup, so refund reporting is groupable, and two rules the table cannot
 * express:
 *
 * - **at most two levels.** A reason may refine another reason and nothing may refine it in turn: a
 *   taxonomy that can go arbitrarily deep is a taxonomy nobody maintains, while the second level —
 *   "damaged" under "item problem" — is as far as a refund conversation goes. The refusal is a service
 *   rule because a self-referencing foreign key cannot express depth, and it is checked on create and
 *   again on update, where a reason could otherwise be moved under one of its own refinements;
 * - **the code is the reportable key and never changes**, because reports cite it, and a reason a
 *   refund cites is deactivated rather than deleted so those reports keep resolving.
 *
 * The service is constructed directly with an in-memory double of its repository, which states the
 * `where` the service states — equality and the `null` column — so the scoping and depth cases below
 * are about the service and not about the double.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';

type Row = Record<string, any>;

/** The tables this suite drives, as plain arrays. */
interface ITables {
	refund_reason: Row[];
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
	const matches = (row: Row, where: Row = {}): boolean =>
		Object.entries(where).every(([field, expected]) => {
			// A missing column and a null column are the same thing to the database, and TypeORM drops
			// an `undefined` member from the condition rather than matching nothing.
			if (expected === undefined) {
				return true;
			}

			return String(row[field] ?? '') === String(expected ?? '');
		});

	return {
		metadata: { tableName, hasColumnWithPropertyPath: () => false },
		find: async (options: any = {}) => rows().filter((row) => matches(row, options.where)),
		findOneBy: async (where: Row) => rows().find((row) => matches(row, where)) ?? null,
		findAndCount: async (options: any = {}) => {
			const items = rows().filter((row) => matches(row, options.where));

			return [items, items.length];
		},
		count: async () => rows().length,
		create: (partial: Row) => ({ ...partial }),
		save: async (entity: Row) => {
			if (entity.id) {
				const index = rows().findIndex((row) => row.id === entity.id);

				if (index >= 0) {
					rows()[index] = { ...rows()[index], ...entity };

					return rows()[index];
				}
			}

			const created = { id: `${String(tableName)}-new-${++sequence}`, ...entity };

			rows().push(created);

			return created;
		},
		update: async (criteria: any, partial: Row) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = rows().findIndex((row) => row.id === id);

			if (index >= 0) {
				Object.assign(rows()[index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		delete: async (criteria: any) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = rows().findIndex((row) => row.id === id);

			if (index >= 0) {
				rows().splice(index, 1);
			}

			return { affected: index >= 0 ? 1 : 0 };
		}
	};
}

/** One `refund_reason` row, as the service reads it. */
const reasonRow = (id: string, overrides: Row = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	code: id,
	label: `Reason ${id}`,
	isActive: true,
	...overrides
});

/**
 * Builds the reason service over one in-memory `refund_reason` table.
 *
 * @param rows The reasons the fixture starts with.
 */
function reasonFixture(rows: Row[] = []) {
	const tables: ITables = { refund_reason: [...rows] };
	const service = new RefundReasonService(repository(tables, 'refund_reason') as never, {} as never);

	return { service, tables, store: (id: string) => tables.refund_reason.find((row) => row.id === id) };
}

/** The two-level taxonomy the depth cases walk: `item-problem` → `damaged`, and a separate root. */
function taxonomyFixture() {
	return reasonFixture([
		reasonRow('item-problem', { code: 'ITEM_PROBLEM', label: 'Item problem' }),
		reasonRow('damaged', { code: 'DAMAGED', label: 'Damaged', parentId: 'item-problem' }),
		reasonRow('goodwill', { code: 'GOODWILL', label: 'Goodwill' })
	]);
}

describe('RefundReasonService — what a reason may not be (doc 05 §12.6)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses a reason with no code, and one whose code is only whitespace', async () => {
		const fixture = reasonFixture();

		await expect(fixture.service.createReason({ label: 'Damaged' } as never)).rejects.toThrow(
			/REFUND_REASON_CODE_REQUIRED/
		);
		await expect(fixture.service.createReason({ code: '  ', label: 'Damaged' } as never)).rejects.toThrow(
			/REFUND_REASON_CODE_REQUIRED/
		);
		expect(fixture.tables.refund_reason).toEqual([]);
	});

	it('refuses a reason with no label, and one whose label is only whitespace', async () => {
		const fixture = reasonFixture();

		await expect(fixture.service.createReason({ code: 'DAMAGED' } as never)).rejects.toThrow(
			/REFUND_REASON_LABEL_REQUIRED/
		);
		await expect(fixture.service.createReason({ code: 'DAMAGED', label: ' ' } as never)).rejects.toThrow(
			/REFUND_REASON_LABEL_REQUIRED/
		);
		expect(fixture.tables.refund_reason).toEqual([]);
	});

	it('refuses a code this organization already reports under', async () => {
		// `UQ_refund_reason_org_code` claims `(organizationId, code)`: reporting groups by the code, so two
		// reasons claiming one code would make a report ambiguous.
		const fixture = taxonomyFixture();

		await expect(
			fixture.service.createReason({ code: 'DAMAGED', label: 'Damaged again' } as never)
		).rejects.toThrow(/already exists in this organization/);
		expect(fixture.tables.refund_reason).toHaveLength(3);
	});

	it('resolves a code inside the caller’s organization and nowhere else', async () => {
		const fixture = reasonFixture([
			reasonRow('mine', { code: 'DAMAGED' }),
			reasonRow('theirs', { code: 'DAMAGED', organizationId: OTHER_ORG })
		]);

		expect((await fixture.service.findByCode('DAMAGED')).id).toBe('mine');

		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(OTHER_ORG);

		expect((await fixture.service.findByCode('DAMAGED')).id).toBe('theirs');
	});

	// The depth rule on create: the parent must be a root, so a reason cannot refine another refinement.
	// The rule is reached only because the uniqueness read above answers rather than refuses — a code that
	// is free is the ordinary state of a taxonomy, and `findByCode` reports it as `null` instead of
	// raising `NotFoundException` for it.
	it('refuses a refinement of a refinement, so the taxonomy stays two levels deep', async () => {
		const fixture = taxonomyFixture();

		await expect(
			fixture.service.createReason({
				code: 'DAMAGED_IN_TRANSIT',
				label: 'Damaged in transit',
				parentId: 'damaged'
			} as never)
		).rejects.toThrow(/REFUND_REASON_DEPTH_EXCEEDED/);
		expect(fixture.tables.refund_reason).toHaveLength(3);
	});

	it('reports a parent that does not resolve, and another organization’s parent, as missing', async () => {
		// The parent is resolved inside the caller's own organization: a reason of another organization is
		// not a reason this one's taxonomy may hang from.
		const fixture = reasonFixture([reasonRow('mine'), reasonRow('theirs', { organizationId: OTHER_ORG })]);

		await expect(fixture.service.updateReason('mine', { parentId: 'nope' } as never)).rejects.toBeInstanceOf(
			NotFoundException
		);
		await expect(fixture.service.updateReason('mine', { parentId: 'theirs' } as never)).rejects.toBeInstanceOf(
			NotFoundException
		);
		expect(fixture.store('mine').parentId).toBeUndefined();
	});
});

describe('RefundReasonService — the code is what reports cite (doc 05 §12.6)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses an update that would change the code', async () => {
		const fixture = taxonomyFixture();

		await expect(fixture.service.updateReason('damaged', { code: 'BROKEN' } as never)).rejects.toThrow(
			/cannot change/
		);
		expect(fixture.store('damaged').code).toBe('DAMAGED');
	});

	it('accepts an update that re-states the code it already has', async () => {
		const fixture = taxonomyFixture();

		const updated = await fixture.service.updateReason('damaged', {
			code: ' DAMAGED ',
			label: 'Arrived damaged'
		} as never);

		expect(updated).toMatchObject({ code: 'DAMAGED', label: 'Arrived damaged' });
	});

	it('refuses to make a reason its own parent', async () => {
		const fixture = taxonomyFixture();

		await expect(fixture.service.updateReason('damaged', { parentId: 'damaged' } as never)).rejects.toThrow(
			/REFUND_REASON_CYCLE/
		);
		expect(fixture.store('damaged')).toMatchObject({ parentId: 'item-problem' });
	});

	it('refuses to move a reason under one of its own refinements', async () => {
		const fixture = taxonomyFixture();

		await expect(
			fixture.service.updateReason('item-problem', { parentId: 'damaged' } as never)
		).rejects.toThrow(/REFUND_REASON_DEPTH_EXCEEDED/);
		expect(fixture.store('item-problem').parentId).toBeUndefined();
		expect(fixture.store('damaged')).toMatchObject({ parentId: 'item-problem' });
	});

	it('refuses to move a reason under a reason that is itself a refinement', async () => {
		const fixture = taxonomyFixture();

		await expect(fixture.service.updateReason('goodwill', { parentId: 'damaged' } as never)).rejects.toThrow(
			/REFUND_REASON_DEPTH_EXCEEDED/
		);
		expect(fixture.store('goodwill').parentId).toBeUndefined();
	});

	it('accepts making a reason a root again, and moving a leaf under another root', async () => {
		// Controls: neither move creates a third level, so neither is refused. `parentId: null` is how a
		// reason that was refined stops being one.
		const promoted = taxonomyFixture();

		expect(await promoted.service.updateReason('damaged', { parentId: null } as never)).toMatchObject({
			parentId: null
		});

		const moved = taxonomyFixture();

		expect(await moved.service.updateReason('goodwill', { parentId: 'item-problem' } as never)).toMatchObject({
			parentId: 'item-problem'
		});
	});

	it('deactivates a reason instead of deleting it, keeping everything a report cites', async () => {
		// A reason a refund cites is deactivated, not deleted: the reporting that cites it keeps resolving.
		const fixture = taxonomyFixture();

		const deactivated = await fixture.service.deactivateReason('damaged');

		expect(deactivated).toMatchObject({ isActive: false, code: 'DAMAGED', label: 'Damaged' });
		expect(fixture.tables.refund_reason).toHaveLength(3);
		expect((await fixture.service.findByCode('DAMAGED')).isActive).toBe(false);
	});

	it('reports an unknown reason, and another organization’s reason, as missing', async () => {
		const fixture = reasonFixture([reasonRow('theirs', { organizationId: OTHER_ORG })]);

		await expect(fixture.service.findReasonOrFail('nope')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.findReasonOrFail('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.deactivateReason('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.updateReason('theirs', { label: 'x' } as never)).rejects.toBeInstanceOf(
			NotFoundException
		);
		expect(fixture.store('theirs').isActive).toBe(true);
	});

	it('paginates the reasons of the caller’s organization, and only those', async () => {
		const fixture = reasonFixture([
			reasonRow('mine'),
			reasonRow('also-mine'),
			reasonRow('theirs', { organizationId: OTHER_ORG })
		]);

		const page = await fixture.service.findReasons();

		expect(page.total).toBe(2);
		expect(page.items.map((reason) => reason.id).sort()).toEqual(['also-mine', 'mine']);
	});
});

/**
 * The creation of a reason, and the depth of a move.
 *
 * `createReason` asks "is this code free?" through the fail-soft read, whose documented answer for an
 * absent row is `null`: a code that is free is the ordinary state of a taxonomy, so the read answers
 * rather than refuses, and the operator path that populates the taxonomy exists. The second case is the
 * depth rule read from the other end — a move is judged on both the parent and the reason being moved,
 * because a reason that already has refinements carries them with it.
 */
describe('RefundReasonService — creation and the depth of a move (doc 05 §12.6, I-52)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('creates a reason whose code is free, trimmed and inside the caller’s organization', async () => {
		const fixture = reasonFixture();

		const created = await fixture.service.createReason({
			code: '  DAMAGED  ',
			label: '  Arrived damaged  '
		} as never);

		expect(created).toMatchObject({
			code: 'DAMAGED',
			label: 'Arrived damaged',
			tenantId: TENANT,
			organizationId: ORG
		});
		expect(fixture.tables.refund_reason).toHaveLength(1);
	});

	it('refuses a move that would make a reason a third level deep', async () => {
		// `item-problem` refines nothing and is refined by `damaged`, so giving it a parent would put
		// `damaged` — and every other refinement it has — one level below the two the taxonomy allows.
		const fixture = taxonomyFixture();

		await expect(
			fixture.service.updateReason('item-problem', { parentId: 'goodwill' } as never)
		).rejects.toThrow(/REFUND_REASON_DEPTH_EXCEEDED/);
		expect(fixture.store('item-problem').parentId).toBeUndefined();
		expect(fixture.store('damaged')).toMatchObject({ parentId: 'item-problem' });
	});
});
