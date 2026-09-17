/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a lookup service needs and none of which is available
 * outside a running application. The seam is therefore doubled at the module boundary, exactly as the
 * catalogue and inventory packages' service specs do, and **the service under test is the real one**:
 * only the base CRUD class, the request context and the entity base classes are substituted.
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

		async create(entity: any): Promise<any> {
			return this.typeOrmRepository.save(this.typeOrmRepository.create(entity));
		}

		async update(id: any, partial: any): Promise<any> {
			return this.typeOrmRepository.update(id, partial);
		}

		async delete(criteria: any): Promise<any> {
			return this.typeOrmRepository.delete(criteria);
		}

		async softDelete(criteria: any): Promise<any> {
			return this.typeOrmRepository.softDelete(criteria);
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
		MultiORMManyToOne: decorator,
		MultiORMOneToMany: decorator,
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
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		SequenceService: class SequenceService {},
		Warehouse: class Warehouse {},
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

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RequestContext } from '@gauzy/core';
import { OrderReturnReasonService } from './order-return-reason.service';

/**
 * The governed reason codes a return can be filed under.
 *
 * Two rules make this more than a lookup table, and both are rules about **history**: the returns
 * already filed against a reason are grouped by its code, so (doc 10 §11.2, and the service's own
 * statement of the pair)
 *
 * - the code is unique inside the organization and **immutable once the reason exists** — a code that
 *   could move would silently re-label every return filed under it;
 * - a used reason is **deactivated, never deleted**, because removing the row would leave those
 *   returns unexplainable in a report.
 *
 * The third rule is the shape: the tree is two levels deep — a reason and its variants — because
 * that is the depth a return form can present without becoming a taxonomy, so a variant of a variant
 * is refused rather than flattened.
 *
 * The service is constructed directly with an in-memory double of its repository. The double states
 * the `where` the service states, because a double that returned every row regardless would make the
 * code-uniqueness and organization-scope cases below vacuous.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';

type Row = Record<string, any>;

/**
 * The in-memory stand-in for the reason table's TypeORM repository.
 *
 * @param rows The whole table.
 */
function repository(rows: Row[]) {
	let sequence = 0;
	const live = () => rows.filter((row) => !row.deletedAt);
	const same = (left: unknown, right: unknown) => String(left ?? '') === String(right ?? '');
	const matches = (row: Row, where: Row = {}): boolean =>
		Object.entries(where ?? {}).every(([field, expected]) => {
			// TypeORM drops an `undefined` member from the condition rather than matching nothing.
			if (expected === undefined) {
				return true;
			}

			return same(row[field], expected);
		});

	return {
		rows,
		find: async (options: any = {}) => live().filter((row) => matches(row, options.where)),
		findOne: async (options: any = {}) => live().find((row) => matches(row, options.where)) ?? null,
		findOneBy: async (where: any) => live().find((row) => matches(row, where)) ?? null,
		findAndCount: async (options: any = {}) => {
			const items = live().filter((row) => matches(row, options.where));

			return [items, items.length];
		},
		create: (partial: any) => ({ ...partial }),
		save: async (entity: any) => {
			if (entity.id) {
				const index = rows.findIndex((row) => same(row.id, entity.id));

				if (index >= 0) {
					rows[index] = { ...rows[index], ...entity };

					return rows[index];
				}
			}

			const created = { id: `reason-new-${++sequence}`, ...entity };

			rows.push(created);

			return created;
		},
		update: async (criteria: any, partial: any) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = rows.findIndex((row) => same(row.id, id));

			if (index >= 0) {
				Object.assign(rows[index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		softDelete: async (criteria: any) => {
			const matching = rows.filter((row) => matches(row, criteria));

			for (const row of matching) {
				row.deletedAt = new Date();
			}

			return { affected: matching.length };
		},
		delete: async (criteria: any) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = rows.findIndex((row) => same(row.id, id));

			if (index >= 0) {
				rows.splice(index, 1);
			}

			return { affected: index >= 0 ? 1 : 0 };
		}
	};
}

/** One `order_return_reason` row, as the service reads it. */
const reasonRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	code: id.toUpperCase(),
	label: `Reason ${id}`,
	isActive: true,
	...overrides
});

/**
 * Builds the reason service over one in-memory table.
 *
 * @param rows The reasons the fixture starts with.
 */
function reasonFixture(rows: Row[] = []) {
	const table = [...rows];
	const service = new OrderReturnReasonService(repository(table) as never, {} as never);

	return {
		service,
		table,
		reason: (id: string) => table.find((row) => row.id === id),
		live: () => table.filter((row) => !row.deletedAt)
	};
}

describe('OrderReturnReasonService — the code is the reporting key (doc 10 §11.2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('creates a reason under the caller’s tenant and organization, with the code trimmed', async () => {
		const fixture = reasonFixture();

		const created = await fixture.service.create({ code: '  SIZE_TOO_SMALL  ', label: 'Too small' });

		expect(created).toMatchObject({
			code: 'SIZE_TOO_SMALL',
			label: 'Too small',
			tenantId: TENANT,
			organizationId: ORG
		});
		expect(fixture.live()).toHaveLength(1);
	});

	it('refuses a reason with no code at all', async () => {
		// The code is what makes the reason usable as a reporting key, so its absence is a refusal rather
		// than a row with an empty key.
		const fixture = reasonFixture();

		await expect(fixture.service.create({ label: 'Somebody forgot' })).rejects.toBeInstanceOf(BadRequestException);
		await expect(fixture.service.create({ code: '   ', label: 'Blank' })).rejects.toThrow(/needs a code/);
		expect(fixture.table).toEqual([]);
	});

	it('refuses a code the organization already holds', async () => {
		const fixture = reasonFixture([reasonRow('taken', { code: 'DAMAGED_IN_TRANSIT' })]);

		await expect(fixture.service.create({ code: 'DAMAGED_IN_TRANSIT', label: 'Duplicate' })).rejects.toThrow(
			/A return reason with the code "DAMAGED_IN_TRANSIT" already exists/
		);
		expect(fixture.live()).toHaveLength(1);
	});

	it('accepts the same code in another organization', async () => {
		// Control: the uniqueness is per organization, so a second tenant's seeded catalogue is its own.
		const fixture = reasonFixture([reasonRow('mine', { code: 'OTHER' })]);

		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(OTHER_ORG);

		const created = await fixture.service.create({ code: 'OTHER', label: 'Other' });

		expect(created.organizationId).toBe(OTHER_ORG);
		expect(fixture.live()).toHaveLength(2);
	});

	it('creates a variant under a root reason', async () => {
		const fixture = reasonFixture([reasonRow('root', { code: 'DEFECTIVE' })]);

		const created = await fixture.service.create({ code: 'DEFECTIVE_ZIP', label: 'Zip failed', parentId: 'root' });

		expect(created).toMatchObject({ parentId: 'root', code: 'DEFECTIVE_ZIP' });
	});

	it('refuses a variant of a variant, because the tree is two levels deep', async () => {
		// The depth a return form can present without becoming a taxonomy — and the refusal is what keeps
		// `findTree`'s single pass over roots and variants an honest answer.
		const fixture = reasonFixture([
			reasonRow('root', { code: 'DEFECTIVE' }),
			reasonRow('variant', { code: 'DEFECTIVE_ZIP', parentId: 'root' })
		]);

		await expect(
			fixture.service.create({ code: 'DEEPER', label: 'Too deep', parentId: 'variant' })
		).rejects.toThrow(/two levels deep/);
		expect(fixture.live()).toHaveLength(2);
	});

	it('refuses a parent that does not exist in the caller’s organization', async () => {
		const fixture = reasonFixture([reasonRow('theirs', { code: 'OTHER', organizationId: OTHER_ORG })]);

		await expect(
			fixture.service.create({ code: 'MINE', label: 'Mine', parentId: 'theirs' })
		).rejects.toThrow(/parent return reason was not found/);
		await expect(
			fixture.service.create({ code: 'MINE', label: 'Mine', parentId: 'no-such-reason' })
		).rejects.toThrow(/parent return reason was not found/);
		expect(fixture.live()).toHaveLength(1);
	});
});

describe('OrderReturnReasonService — the code is immutable once it has been used (doc 10 §11.2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses to recode a reason, because the returns filed against it are grouped by that code', async () => {
		const fixture = reasonFixture([reasonRow('reason-1', { code: 'CHANGED_MIND' })]);

		await expect(fixture.service.update('reason-1', { code: 'MIND_CHANGED' })).rejects.toThrow(
			/code of a return reason cannot change/
		);
		expect(fixture.reason('reason-1')).toMatchObject({ code: 'CHANGED_MIND' });
	});

	it('accepts an update that restates the same code, and one that changes the label', async () => {
		// Control for the refusal above: a form that posts every field it knows about sends the code back
		// unchanged, and that is not a recode.
		const fixture = reasonFixture([reasonRow('reason-1', { code: 'CHANGED_MIND', label: 'Changed mind' })]);

		const updated = await fixture.service.update('reason-1', { code: 'CHANGED_MIND', label: 'Customer changed mind' });

		expect(updated).toMatchObject({ code: 'CHANGED_MIND', label: 'Customer changed mind' });
	});

	it('refuses to make a reason its own parent', async () => {
		const fixture = reasonFixture([reasonRow('reason-1')]);

		await expect(fixture.service.update('reason-1', { parentId: 'reason-1' })).rejects.toThrow(
			/cannot be its own parent/
		);
		expect(fixture.reason('reason-1')?.parentId).toBeUndefined();
	});

	it('refuses to move a reason under a variant', async () => {
		const fixture = reasonFixture([
			reasonRow('root'),
			reasonRow('variant', { parentId: 'root' }),
			reasonRow('other', { parentId: 'root' })
		]);

		await expect(fixture.service.update('other', { parentId: 'variant' })).rejects.toThrow(/two levels deep/);
		expect(fixture.reason('other')).toMatchObject({ parentId: 'root' });
	});

	it('refuses to update another organization’s reason, or one that does not exist', async () => {
		const fixture = reasonFixture([reasonRow('theirs', { organizationId: OTHER_ORG })]);

		await expect(fixture.service.update('theirs', { label: 'Nope' })).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.update('no-such-reason', { label: 'Nope' })).rejects.toBeInstanceOf(
			NotFoundException
		);
	});
});

describe('OrderReturnReasonService — a used reason is deactivated, never deleted (doc 10 §11.2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('deactivates a reason and leaves the row in place', async () => {
		// The returns already filed against the reason are grouped by its code, so removing the row would
		// leave them unexplainable in a report. The row stays; only its selectability changes.
		const fixture = reasonFixture([reasonRow('reason-1', { code: 'LATE_DELIVERY' })]);

		const deactivated = await fixture.service.deactivate('reason-1');

		expect(deactivated).toMatchObject({ isActive: false, code: 'LATE_DELIVERY' });
		expect(fixture.table).toHaveLength(1);
		expect(fixture.reason('reason-1')?.deletedAt).toBeUndefined();
	});

	it('refuses to deactivate another organization’s reason', async () => {
		const fixture = reasonFixture([reasonRow('theirs', { organizationId: OTHER_ORG })]);

		await expect(fixture.service.deactivate('theirs')).rejects.toBeInstanceOf(NotFoundException);
		expect(fixture.reason('theirs')?.isActive).toBe(true);
	});
});

describe('OrderReturnReasonService — the two-level tree and the active catalogue', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('hangs every variant under its own root and leaves a variant childless', async () => {
		const fixture = reasonFixture([
			reasonRow('size', { code: 'SIZE_TOO_SMALL' }),
			reasonRow('damaged', { code: 'DAMAGED_IN_TRANSIT' }),
			reasonRow('size-s', { code: 'TOO_SMALL_S', parentId: 'size' }),
			reasonRow('size-m', { code: 'TOO_SMALL_M', parentId: 'size' }),
			reasonRow('damaged-glass', { code: 'DAMAGED_GLASS', parentId: 'damaged' })
		]);

		const tree = await fixture.service.findTree();

		expect(tree.total).toBe(5);
		expect(tree.items.find((reason) => reason.id === 'size')?.children?.map((child) => child.id)).toEqual([
			'size-s',
			'size-m'
		]);
		expect(tree.items.find((reason) => reason.id === 'size-s')?.children).toBeUndefined();
		// The variants are still in the listing rather than only under their parent: a picker that reads
		// the flat page still sees every reason it may file a return under.
		expect(tree.items.map((reason) => reason.id)).toContain('damaged-glass');
	});

	it('leaves a variant whose root is not in the page unattached rather than inventing a parent', async () => {
		// A filtered or paginated listing may hold a variant whose root fell outside it; the variant is
		// still returned, and no root is fabricated for it.
		const fixture = reasonFixture([reasonRow('orphan', { code: 'ORPHAN', parentId: 'not-in-this-page' })]);

		const tree = await fixture.service.findTree();

		expect(tree.items).toHaveLength(1);
		expect(tree.items[0].children).toBeUndefined();
	});

	it('answers a listing that holds no root unchanged', async () => {
		const fixture = reasonFixture();

		await expect(fixture.service.findTree()).resolves.toMatchObject({ items: [], total: 0 });
	});

	it('reads the active reasons of the caller’s organization, and only those', async () => {
		const fixture = reasonFixture([
			reasonRow('active', { isActive: true }),
			reasonRow('inactive', { isActive: false }),
			reasonRow('theirs', { isActive: true, organizationId: OTHER_ORG })
		]);

		const active = await fixture.service.findActive();

		expect(active.map((reason) => reason.id)).toEqual(['active']);
	});

	it('refuses to read another organization’s reason', async () => {
		const fixture = reasonFixture([reasonRow('mine'), reasonRow('theirs', { organizationId: OTHER_ORG })]);

		await expect(fixture.service.findOneScoped('mine')).resolves.toMatchObject({ id: 'mine' });
		await expect(fixture.service.findOneScoped('theirs')).rejects.toBeInstanceOf(NotFoundException);
	});
});
