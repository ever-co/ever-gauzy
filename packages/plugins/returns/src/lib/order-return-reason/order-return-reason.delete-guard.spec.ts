/**
 * The destructive removal of a governed return reason, and the guard that makes it a removal of an
 * *unused* one (doc 10 §11.2; `06-api-specification.md` §7.14).
 *
 * `order_return.reasonId` and `order_return_line.reasonId` are both `SET NULL`, so a physical delete of
 * a reason that returns were filed under does not fail — it succeeds and nulls the reason on every one
 * of them, leaving a report that groups returns by reason code with a column of blanks. That is the
 * outcome the governed list exists to prevent, and it is why the controller's own `DELETE
 * /order-return-reasons/:id` deactivates the row rather than removing it, keeping it for the reports
 * that read it by code.
 *
 * The route that *does* remove is `DELETE /order-return-reasons/:id/hard`, and its handler describes
 * itself as removing "a reason that was never used". Until this guard existed nothing on either surface
 * checked that claim: the handler reached the base CRUD `delete` and the physical statement ran whatever
 * the reason had explained. The guard is what turns the summary into a contract.
 *
 * Four things are pinned here, because each is a way the guard could be wrong:
 *
 * - it **refuses** a reason a return names, and a reason a *line* names — the two columns are
 *   independent, and a reason used only at line level is the case a header-only check would let through;
 * - it **counts retired returns and retired lines**, because a soft-deleted return can be restored and
 *   the reason it was filed under has to still be there when it is;
 * - it **allows** a reason nothing names, which is the whole population the route exists for;
 * - it **scopes the count to the reason's own tenant and organization**, so the refusal is about this
 *   reason rather than about a count that reached across tenants.
 *
 * `@gauzy/core` is doubled at the module boundary, exactly as this package's other service specs do it:
 * the barrel boots the whole application graph — configuration, the ORM, the job registry — none of
 * which a lookup service needs. **The service under test is the real one**, and so is the base class's
 * `delete`, which is written here as `CrudService.delete` writes it — the criteria, and the repository's
 * own `delete` — so the delegation the guard wraps is the platform's shape and not an invention of this
 * file.
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
		VersionedColumn: decorator,
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

import { NotFoundException } from '@nestjs/common';
import { RequestContext } from '@gauzy/core';
import { OrderReturnReasonService } from './order-return-reason.service';

type Row = Record<string, any>;

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_TENANT = '00000000-0000-4000-8000-000000000003';

/** The reason every test is about, if it says nothing else. */
const REASON = 'reason-1';

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
 * The stores the guard counts, keyed by the entity it is asked about.
 *
 * They are keyed by the *class*, not by a table name, because that is how the guard asks:
 * `manager.count(OrderReturn, …)` names the entity it wants counted, and a double keyed on anything else
 * would answer every question with the same number — which is exactly the bug this suite has to be able
 * to see.
 */
interface IStores {
	order_return: Row[];
	order_return_line: Row[];
}

/**
 * Builds the real service over in-memory stores and a manager that counts them the way TypeORM does.
 *
 * @param options.reasons The reasons the fixture starts with.
 * @param options.usages The returns and lines that name a reason, by reason id.
 * @returns The service, the stores and every count the guard asked for.
 */
function reasonFixture(
	options: {
		reasons?: Row[];
		usages?: Record<string, { returns?: Row[]; lines?: Row[] }>;
	} = {}
) {
	const reasons = [...(options.reasons ?? [reasonRow(REASON)])];
	const usages = options.usages ?? {};

	/** Every count the manager was asked for, so the scope and the entity can both be asserted. */
	const counts: Array<{ entity: unknown; options: Row }> = [];

	const repository: Row = {
		findOne: async (options_: Row = {}) =>
			reasons.find((row) => {
				const where = options_.where ?? {};

				return Object.entries(where).every(([field, expected]) => row[field] === expected);
			}) ?? null,
		delete: async (criteria: any) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = reasons.findIndex((row) => row.id === id);

			if (index >= 0) {
				reasons.splice(index, 1);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		manager: {
			count: async (entity: unknown, options_: Row = {}) => {
				counts.push({ entity, options: options_ });

				// The entity's own class name, which is what TypeORM's `count` is handed and what decides
				// which store answers. A double that keyed on anything else would answer both questions with
				// the same rows — which is the bug this suite exists to be able to see, so the key is the
				// thing the guard actually passes rather than a table name this file chose.
				const entityName = (entity as { name?: string })?.name ?? '';
				const where = options_.where ?? {};
				const candidates = Object.values(usages).flatMap((usage) =>
					entityName === 'OrderReturn' ? usage.returns ?? [] : usage.lines ?? []
				);

				return candidates.filter((row) => Object.entries(where).every(([field, expected]) => row[field] === expected))
					.length;
			}
		}
	};

	const service = new OrderReturnReasonService(repository as never, {} as never);

	return {
		service,
		reasons,
		counts,
		reason: (id: string) => reasons.find((row) => row.id === id)
	};
}

describe('OrderReturnReasonService — a reason in use is not physically removed (doc 10 §11.2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses a reason a return is filed under, and removes nothing', async () => {
		const fixture = reasonFixture({
			usages: { [REASON]: { returns: [{ id: 'return-1', reasonId: REASON, tenantId: TENANT, organizationId: ORG }] } }
		});

		await expect(fixture.service.delete(REASON)).rejects.toThrow(/RETURN_REASON_IN_USE/);

		// The row is still there: a guard that refused after the statement ran would be no guard at all.
		expect(fixture.reason(REASON)).toBeDefined();
	});
	it('names the counts and the act that retires the reason instead', async () => {
		// The refusal is only actionable if it says what to do instead. `deleteOrderReturnReason` and
		// `DELETE /order-return-reasons/:id` deactivate the reason, which keeps the row for every report
		// that groups returns by its code — that is the answer, and the payload has to carry it.
		const fixture = reasonFixture({
			usages: {
				[REASON]: {
					returns: [{ id: 'return-1', reasonId: REASON, tenantId: TENANT, organizationId: ORG }],
					lines: [
						{ id: 'line-1', reasonId: REASON, tenantId: TENANT, organizationId: ORG },
						{ id: 'line-2', reasonId: REASON, tenantId: TENANT, organizationId: ORG }
					]
				}
			}
		});

		// Read through the exception's own accessor rather than its `response` field, so the assertion is
		// about the payload NestJS answers with rather than about where it keeps it.
		const refusal = await fixture.service.delete(REASON).then(
			() => null,
			(error) => error
		);

		expect(refusal?.getResponse()).toMatchObject({
			code: 'RETURN_REASON_IN_USE',
			details: { reasonId: REASON, code: 'REASON-1', returns: 1, lines: 2 }
		});
	});

	it('refuses a reason only a return line names', async () => {
		// The case a header-only check would let through. A line carries its own `reasonId` and overrides
		// the header's, so a reason used exclusively at line level still explains rows that a report reads
		// by code — and its removal nulls them just the same.
		const fixture = reasonFixture({
			usages: { [REASON]: { lines: [{ id: 'line-1', reasonId: REASON, tenantId: TENANT, organizationId: ORG }] } }
		});

		await expect(fixture.service.delete(REASON)).rejects.toThrow(/still explains 0 return\(s\) and 1 return line\(s\)/);
		expect(fixture.reason(REASON)).toBeDefined();
	});

	it('counts retired returns and retired lines, because both can come back', async () => {
		// A soft-deleted return is restorable — `recoverOrderReturn` and `PUT /order-returns/:id/recover` do
		// exactly that — and the reason it was filed under has to still resolve when it returns. A guard
		// that read only the live rows would let the destructive route succeed and then hand the restore a
		// return whose reason had vanished, which is `order_return.reasonId` reading `null` on a row that
		// was filed under a code.
		const fixture = reasonFixture({
			usages: {
				[REASON]: {
					returns: [
						{
							id: 'return-1',
							reasonId: REASON,
							tenantId: TENANT,
							organizationId: ORG,
							deletedAt: new Date('2026-02-01T00:00:00.000Z')
						}
					]
				}
			}
		});

		await expect(fixture.service.delete(REASON)).rejects.toThrow(/RETURN_REASON_IN_USE/);
		expect(fixture.reason(REASON)).toBeDefined();
	});

	it('removes a reason nothing names, and asks both entities that could name it', async () => {
		// The population the route exists for, and the control that stops the three refusals above from
		// passing on a guard that refuses everything. Both queries are asserted, because a guard that asked
		// only the returns would let a line-level reason through.
		const fixture = reasonFixture({ usages: {} });

		const removed = await fixture.service.delete(REASON);

		expect(removed).toMatchObject({ affected: 1 });
		expect(fixture.reason(REASON)).toBeUndefined();
		expect(fixture.counts.map(({ entity }) => (entity as { name?: string }).name)).toEqual([
			'OrderReturn',
			'OrderReturnLine'
		]);
	});

	it('scopes both counts to the reason’s own tenant and organization', async () => {
		// A count that spanned tenants would refuse a removal because another tenant's row carries the same
		// identifier — which no identifier can — and the guard would then be firing on nothing. The scope is
		// read from the reason rather than from the request, because the reason is the row the statement is
		// about.
		const fixture = reasonFixture({
			usages: {
				[REASON]: {
					returns: [
						{ id: 'foreign', reasonId: REASON, tenantId: OTHER_TENANT, organizationId: ORG }
					]
				}
			}
		});

		await fixture.service.delete(REASON);

		expect(fixture.counts).toHaveLength(2);

		for (const { options } of fixture.counts) {
			expect(options.where).toMatchObject({ reasonId: REASON, tenantId: TENANT, organizationId: ORG });
			expect(options.withDeleted).toBe(true);
		}
	});

	it('refuses a reason that is not the caller’s before it counts anything', async () => {
		// The read the guard is built on is the same scoped read every other method of this service uses, so
		// a reason of another tenant is a 404 rather than a count of zero followed by a delete. Without it
		// the guard would be the one method here that could touch a row its caller cannot see.
		const fixture = reasonFixture({ reasons: [reasonRow(REASON, { tenantId: OTHER_TENANT })] });

		await expect(fixture.service.delete(REASON)).rejects.toBeInstanceOf(NotFoundException);
		expect(fixture.counts).toEqual([]);
	});
});
