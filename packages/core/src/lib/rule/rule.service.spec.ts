import { BadRequestException } from '@nestjs/common';
import { IRule, IRuleCreateInput, RuleOperator, RuleOwnerType, RuleScope, RuleValueType } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
import { Rule } from './rule.entity';
import { RuleValidationCode } from './rule.validator';
import { RuleService } from './rule.service';
import { TypeOrmRuleRepository } from './repository/type-orm-rule.repository';

/**
 * Reading, writing and evaluating one owner's rule set.
 *
 * Everything that decides *whether* a rule matches is a pure function the evaluator suite covers.
 * What this suite is about is the part that needs a row: a rule of one tenant is invisible to
 * another, a write is stamped with the caller's tenant, a rule whose shape the evaluator cannot
 * trust never reaches the table, and replacing a set replaces it whole — because a rule set that
 * exists for a moment in a state its author never wrote is a promotion that fires for the wrong
 * customer.
 *
 * The table is an in-memory one that behaves like the table it stands in for: it applies the `where`
 * and the `order` the service asks for, records what it was asked for, and rolls a transaction back
 * when the work inside it throws.
 */

type Row = Record<string, any>;

/**
 * An in-memory stand-in for the `rule` table.
 *
 * `find` filters on the criteria it is given and sorts on the ordering it is given, so a service that
 * stopped narrowing a read to one owner — or stopped ordering the rows the evaluator walks — is
 * caught here rather than accommodated.
 */
class RuleTable {
	readonly rows: Row[] = [];
	/** Every criteria the service asked for, so a case can assert on the narrowing itself. */
	readonly reads: { where?: Row; order?: Row }[] = [];
	readonly deletes: Row[] = [];
	readonly softDeletes: Row[] = [];
	/** The entity each transactional statement was addressed to. */
	readonly entities: unknown[] = [];
	private sequence = 0;

	/** Stands in for `manager.transaction`: work that throws leaves the table as it was. */
	async transaction<R>(work: (manager: any) => Promise<R>): Promise<R> {
		const before = this.rows.map((row) => ({ ...row }));

		try {
			return await work(this.manager);
		} catch (error) {
			this.rows.splice(0, this.rows.length, ...before);

			throw error;
		}
	}

	readonly manager = {
		transaction: <R>(work: (manager: any) => Promise<R>): Promise<R> => this.transaction(work),
		create: (entity: unknown, input: Row): Row => {
			this.entities.push(entity);

			return this.create(input);
		},
		save: (entity: unknown, rows: Row | Row[]): Promise<Row[]> => {
			this.entities.push(entity);

			return this.save(rows);
		},
		delete: (entity: unknown, criteria: Row): Promise<unknown> => {
			this.entities.push(entity);

			return this.remove(criteria);
		}
	};

	create(input: Row): Row {
		this.sequence += 1;

		return { id: `rule-${this.sequence}`, ...input };
	}

	async save(rows: Row | Row[]): Promise<any> {
		for (const row of Array.isArray(rows) ? rows : [rows]) {
			const existing = this.rows.indexOf(row);

			if (existing === -1) {
				this.rows.push(row);
			}
		}

		return rows;
	}

	async find(options: { where?: Row; order?: Row } = {}): Promise<Row[]> {
		this.reads.push(options);

		return this.matching(options.where).sort(byOrder(options.order));
	}

	async softDelete(criteria: Row): Promise<{ affected: number }> {
		this.softDeletes.push(criteria);

		const matched = this.matching(criteria);

		for (const row of matched) {
			row.deletedAt = new Date('2026-03-01T00:00:00Z');
		}

		return { affected: matched.length };
	}

	private async remove(criteria: Row): Promise<{ affected: number }> {
		this.deletes.push(criteria);

		const matched = this.matching(criteria);

		for (const row of matched) {
			this.rows.splice(this.rows.indexOf(row), 1);
		}

		return { affected: matched.length };
	}

	private matching(where: Row = {}): Row[] {
		// A soft-deleted row is not returned by a read, which is what makes `deleteByOwner` invisible
		// to the evaluator's own load.
		return this.rows.filter(
			(row) => !row.deletedAt && Object.entries(where).every(([column, condition]) => matches(row[column], condition))
		);
	}
}

/** One column's condition: equality, with a missing column and a null column being the same thing. */
function matches(value: unknown, condition: unknown): boolean {
	const operator = condition as { _type?: string; _value?: unknown[] };

	if (operator && typeof operator === 'object' && operator._type === 'in' && Array.isArray(operator._value)) {
		return operator._value.includes(value);
	}

	return (value ?? null) === (condition ?? null);
}

/** The comparator `find` sorts with, so `groupIndex ASC, priority ASC` means what it says. */
function byOrder(order: Row = {}): (left: Row, right: Row) => number {
	const columns = Object.keys(order);

	return (left, right) => {
		for (const column of columns) {
			if (left[column] === right[column]) {
				continue;
			}

			const direction = order[column] === 'DESC' ? -1 : 1;

			return (left[column] > right[column] ? 1 : -1) * direction;
		}

		return 0;
	};
}

const OWNER = '2f9c4a17-6b03-4d8e-9a51-3c7e0b1d2f48';
const OTHER_OWNER = '6b1e0f2a-0000-4000-8000-000000000009';

/** One stored rule row, with the fields the evaluator reads. */
const stored = (overrides: Row = {}): Row => ({
	ownerType: RuleOwnerType.PROMOTION,
	ownerId: OWNER,
	scope: RuleScope.ORDER,
	attribute: 'customer.groups.code',
	operator: RuleOperator.EQ,
	value: 'WHOLESALE',
	valueType: RuleValueType.STRING,
	isNegated: false,
	groupIndex: 0,
	priority: 0,
	...overrides
});

/** The input of a rule that passes every check, so a case can vary exactly one thing. */
const input = (overrides: Partial<IRuleCreateInput> = {}): IRuleCreateInput => ({
	ownerType: RuleOwnerType.PROMOTION,
	ownerId: OWNER,
	attribute: 'customer.groups.code',
	operator: RuleOperator.EQ,
	value: 'WHOLESALE',
	...overrides
});

/** The service under test, with the table it writes to. */
function rules(rows: Row[] = []) {
	const table = new RuleTable();

	for (const row of rows) {
		table.rows.push(table.create(row));
	}

	const service = new RuleService(table as unknown as TypeOrmRuleRepository, {} as never);

	return { service, table };
}

/** The message of the error a call raises, or `undefined` when the call does not raise. */
async function refusalOf(call: () => Promise<unknown>): Promise<string | undefined> {
	try {
		await call();

		return undefined;
	} catch (error) {
		return (error as Error).message;
	}
}

afterEach(() => {
	// A case that stands a request context up has to take it down again.
	jest.restoreAllMocks();
});

describe('reading one owner’s rule set', () => {
	it('returns the rules lowest group and lowest priority first, which is the order they are applied in', async () => {
		const { service } = rules([
			stored({ id: 'later', groupIndex: 1, priority: 0 }),
			stored({ id: 'second', groupIndex: 0, priority: 5 }),
			stored({ id: 'first', groupIndex: 0, priority: 1 })
		]);

		// The rows were written out of order, so a read with no ordering would hand the evaluator a
		// trace whose first failed rule is not the one an operator should read first.
		expect((await service.findByOwner(RuleOwnerType.PROMOTION, OWNER)).map((row) => row.id)).toEqual([
			'first',
			'second',
			'later'
		]);
	});

	it('never returns another owner’s rules', async () => {
		const { service } = rules([
			stored({ id: 'mine' }),
			stored({ id: 'theirs', ownerId: OTHER_OWNER }),
			stored({ id: 'other-type', ownerType: RuleOwnerType.PRICE_LIST })
		]);

		expect((await service.findByOwner(RuleOwnerType.PROMOTION, OWNER)).map((row) => row.id)).toEqual(['mine']);
	});

	it('narrows a read to the tenant and organization of the request', async () => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue('org-1');

		const { service, table } = rules([
			stored({ id: 'mine', tenantId: 'tenant-1', organizationId: 'org-1' }),
			stored({ id: 'foreign', tenantId: 'tenant-2', organizationId: 'org-1' })
		]);

		// Control: a read that dropped the tenant from its criteria would hand the evaluator another
		// tenant's conditions, which is the failure this narrowing exists to prevent.
		expect((await service.findByOwner(RuleOwnerType.PROMOTION, OWNER)).map((row) => row.id)).toEqual(['mine']);
		expect(table.reads[0].where).toMatchObject({
			ownerType: RuleOwnerType.PROMOTION,
			ownerId: OWNER,
			tenantId: 'tenant-1',
			organizationId: 'org-1'
		});
	});

	it('scopes by nothing at all when the caller has no tenant, rather than by a null tenant', async () => {
		// A seed run and a migration have no request context; narrowing to `tenantId IS NULL` would
		// make every seeded rule invisible to them.
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(null);

		const { service, table } = rules([stored({ id: 'seeded' })]);

		expect(await service.findByOwner(RuleOwnerType.PROMOTION, OWNER)).toHaveLength(1);
		expect('tenantId' in (table.reads[0].where ?? {})).toBe(false);
		expect('organizationId' in (table.reads[0].where ?? {})).toBe(false);
	});

	it('evaluates the set it just read, so a caller cannot reach a different verdict than the API does', async () => {
		const { service } = rules([stored({ attribute: 'customer.groups.code', value: 'WHOLESALE' })]);

		const result = await service.evaluate(RuleOwnerType.PROMOTION, OWNER, { customer: { groups: { code: 'WHOLESALE' } } });

		expect(result.matched).toBe(true);
		expect(await service.evaluate(RuleOwnerType.PROMOTION, OWNER, { customer: { groups: { code: 'RETAIL' } } })).toMatchObject({
			matched: false
		});
	});
});

describe('writing a rule set', () => {
	it('refuses a rule the evaluator could not trust, before it reaches the table', async () => {
		const { service, table } = rules();

		expect(await refusalOf(() => service.createForOwner(input({ operator: RuleOperator.IN, value: 'A' })))).toContain(
			RuleValidationCode.RULE_VALUE_NOT_ARRAY
		);
		expect(
			await refusalOf(() => service.createForOwner(input({ operator: RuleOperator.GT, value: 'A', valueType: RuleValueType.STRING })))
		).toContain(RuleValidationCode.RULE_OPERATOR_NOT_ALLOWED_FOR_TYPE);
		expect(
			await refusalOf(() => service.createForOwner(input({ ownerType: RuleOwnerType.PROMOTION_ACTION, scope: RuleScope.ORDER })))
		).toContain(RuleValidationCode.RULE_SCOPE_NOT_ALLOWED);

		expect(table.rows).toHaveLength(0);
	});

	it('stamps the caller’s tenant, organization and the defaults a rule row carries', async () => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue('org-1');

		const { service } = rules();
		const row = await service.createForOwner(input());

		expect(row).toMatchObject({
			ownerType: RuleOwnerType.PROMOTION,
			scope: RuleScope.ORDER,
			valueType: RuleValueType.STRING,
			isNegated: false,
			groupIndex: 0,
			priority: 0,
			tenantId: 'tenant-1',
			organizationId: 'org-1'
		});
	});

	it('replaces the whole set of one owner and leaves every other owner alone', async () => {
		const { service, table } = rules([
			stored({ id: 'old', priority: 3 }),
			stored({ id: 'theirs', ownerId: OTHER_OWNER })
		]);

		const replaced = await service.replaceOwnerRules(RuleOwnerType.PROMOTION, OWNER, [
			input({ attribute: 'order.total', operator: RuleOperator.GTE, value: '100.000000', valueType: RuleValueType.DECIMAL }),
			input({ attribute: 'customer.id', operator: RuleOperator.IS_NULL, value: null })
		]);

		expect(replaced).toHaveLength(2);
		expect(table.rows.map((row) => row.id)).toEqual(['theirs', 'rule-3', 'rule-4']);
		expect(table.rows.filter((row) => row.ownerId === OWNER).map((row) => row.attribute)).toEqual([
			'order.total',
			'customer.id'
		]);
		// The replace is addressed to the rule table, inside the caller's transaction, against the
		// owner's rows alone: one delete, two creates and one save.
		expect(table.entities).toHaveLength(4);
		expect(table.entities.every((entity) => entity === Rule)).toBe(true);
		expect(table.deletes[0]).toMatchObject({ ownerType: RuleOwnerType.PROMOTION, ownerId: OWNER });
	});

	it('writes nothing at all when one rule of the replacement set is unusable', async () => {
		// Control: a replace that validated rule by rule would have deleted the working set and then
		// refused the new one, leaving the owner with no conditions at all — a promotion that fires for
		// everybody. The delete and the inserts share one transaction for exactly this reason.
		const { service, table } = rules([stored({ id: 'working', priority: 3 })]);
		const before = table.rows.map((row) => row.id);

		expect(
			await refusalOf(() =>
				service.replaceOwnerRules(RuleOwnerType.PROMOTION, OWNER, [
					input({ attribute: 'order.total' }),
					input({ operator: RuleOperator.BETWEEN, value: [11, 6], valueType: RuleValueType.NUMBER })
				])
			)
		).toContain(RuleValidationCode.RULE_BETWEEN_INVALID);

		expect(table.rows.map((row) => row.id)).toEqual(before);
		expect(table.deletes).toHaveLength(0);
	});

	it('refuses a set beyond the complexity the platform evaluates', async () => {
		const { service, table } = rules();
		const tooManyGroups = Array.from({ length: 21 }, (_unused, index) =>
			input({ attribute: `a${index}`, operator: RuleOperator.IS_NULL, value: null, groupIndex: index })
		);

		expect(await refusalOf(() => service.replaceOwnerRules(RuleOwnerType.PROMOTION, OWNER, tooManyGroups))).toContain(
			RuleValidationCode.RULE_SET_TOO_COMPLEX
		);
		expect(table.rows).toHaveLength(0);
	});

	it('removes an owner’s set within the caller’s own scope', async () => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue('org-1');

		const { service, table } = rules([
			stored({ id: 'mine', tenantId: 'tenant-1', organizationId: 'org-1' }),
			stored({ id: 'foreign', tenantId: 'tenant-2', organizationId: 'org-1' })
		]);

		// Nothing cascades from an owner to its rules, so deleting an owner without this call leaves
		// rows pointing at a row that no longer exists.
		expect(await service.deleteByOwner(RuleOwnerType.PROMOTION, OWNER)).toMatchObject({ affected: 1 });
		expect(table.softDeletes[0]).toMatchObject({ tenantId: 'tenant-1', organizationId: 'org-1' });
		expect(table.rows.find((row) => row.id === 'foreign')?.deletedAt).toBeFalsy();
		expect(await service.findByOwner(RuleOwnerType.PROMOTION, OWNER)).toHaveLength(0);
	});

	it('reports a rejected rule as a bad request rather than as an internal failure', async () => {
		const { service } = rules();

		await expect(service.createForOwner(input({ operator: RuleOperator.IS_NULL, value: 'A' }))).rejects.toBeInstanceOf(
			BadRequestException
		);
	});
});

describe('assertWritable', () => {
	it('accepts a rule the evaluator can trust and refuses one it cannot', () => {
		const { service } = rules();

		expect(() => service.assertWritable(stored() as Partial<IRule>)).not.toThrow();
		expect(() => service.assertWritable(stored({ operator: RuleOperator.MATCHES, value: '(a+)+$' }) as Partial<IRule>)).toThrow(
			/RULE_REGEX_UNSAFE/
		);
	});
});
