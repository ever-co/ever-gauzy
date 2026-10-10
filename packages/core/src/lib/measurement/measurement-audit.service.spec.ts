import { ApiErrorCode } from '../core/errors/api-error-codes';
import { IMeasurementAuditConnection, MeasurementAuditConnection, readCount } from './measurement-audit.connection';
import {
	buildReferenceRules,
	IMeasurementAuditReport,
	MeasurementAuditService
} from './measurement-audit.service';
import { IUnitReference, registerUnitReferences, withdrawUnitReferences } from './unit-references';
import { UnitCategoryCode } from './measurement.constants';

/** The capability that owns the references this suite declares and then withdraws. */
const OWNER = 'measurement-audit-spec';

/** A reference whose rules this suite can predict, with every requirement stated. */
const FULLY_STATED: IUnitReference = {
	table: 'spec_table',
	column: 'unitId',
	owner: OWNER,
	category: UnitCategoryCode.MASS,
	sameCategoryAs: 'otherUnitId',
	referenceUnit: true,
	description: 'A spec reference with every requirement.'
};

/**
 * A connection whose answers are chosen by the test rather than read from a database.
 *
 * The audit is a set of decisions — does this reference exist here, did a rule find rows, could the
 * statement run at all — and a stub is what lets each decision be made on its own. The dialect and
 * the quoter are the real ones, because the statements the audit builds are half of what is being
 * asserted.
 */
function stubConnection(
	answers: Record<string, number | Error>,
	options: {
		tables?: string[];
		columns?: Record<string, string[]>;
		available?: boolean;
		quote?: (identifier: string) => string;
		recorded?: string[];
	} = {}
): IMeasurementAuditConnection {
	const tables = new Set(options.tables ?? ['spec_table', 'unit', 'unit_category']);
	const columns = options.columns ?? {
		spec_table: ['unitId', 'otherUnitId', 'deletedAt'],
		unit: ['id', 'categoryId', 'isReference'],
		unit_category: ['id', 'code']
	};

	return {
		dialect: 'postgres',
		available: options.available ?? true,
		async count(sql: string): Promise<number> {
			options.recorded?.push(sql);

			const key = Object.keys(answers).find((candidate) => sql.includes(candidate));

			if (!key) {
				return 0;
			}

			const answer = answers[key];

			if (answer instanceof Error) {
				throw answer;
			}

			return answer;
		},
		async hasTable(table: string): Promise<boolean | undefined> {
			return tables.has(table);
		},
		async hasColumn(table: string, column: string): Promise<boolean | undefined> {
			return (columns[table] ?? []).includes(column);
		},
		quote: options.quote ?? ((identifier: string) => `"${identifier}"`)
	};
}

/** @param service The audit. @returns Its report. */
function auditWith(connection: IMeasurementAuditConnection): Promise<IMeasurementAuditReport> {
	return new MeasurementAuditService(connection).audit();
}

describe('the measurement audit', () => {
	beforeEach(() => {
		registerUnitReferences([FULLY_STATED]);
	});

	afterEach(() => {
		withdrawUnitReferences(OWNER);
	});

	it('finds nothing on a clean installation', async () => {
		const report = await auditWith(stubConnection({}));

		expect(report.findings).toEqual([]);
		expect(report.unchecked).toEqual([]);
		expect(report.totalViolations).toBe(0);
		expect(report.clean).toBe(true);
	});

	it('evaluates every rule the reference states', async () => {
		const report = await auditWith(stubConnection({}));

		// The dangling rule, the stated family, the sibling family and the reference-unit rule.
		expect(report.checked).toBe(4);
	});

	it('reports a row naming a unit that does not exist', async () => {
		const report = await auditWith(
			stubConnection({ 'NOT EXISTS': 3 }, { recorded: [] })
		);

		expect(report.findings).toHaveLength(1);
		expect(report.findings[0]).toMatchObject({
			table: 'spec_table',
			column: 'unitId',
			owner: OWNER,
			rule: ApiErrorCode.UNIT_REFERENCE_DANGLING,
			violations: 3
		});
		expect(report.clean).toBe(false);
	});

	it('names the column and what it means in the finding', async () => {
		const report = await auditWith(stubConnection({ 'NOT EXISTS': 1 }));

		expect(report.findings[0].description).toBe(FULLY_STATED.description);
	});

	it('orders the findings worst first', async () => {
		// The keys are ordered most specific first, because the stub answers a statement by the first
		// key its text contains — and the sibling statement contains the words of the family one.
		const report = await auditWith(
			stubConnection({ 'own_family': 5, 'isReference': 7, 'family.': 9, 'NOT EXISTS': 2 })
		);

		expect(report.findings.map((finding) => finding.rule)).toEqual([
			ApiErrorCode.UNIT_CATEGORY_MISMATCH,
			ApiErrorCode.STOCK_UNIT_NOT_REFERENCE,
			ApiErrorCode.UNIT_CATEGORY_MISMATCH,
			ApiErrorCode.UNIT_REFERENCE_DANGLING
		]);
		expect(report.findings.map((finding) => finding.violations)).toEqual([9, 7, 5, 2]);
	});

	it('sums the rows that break a rule', async () => {
		const report = await auditWith(stubConnection({ 'NOT EXISTS': 2, 'isReference': 4 }));

		expect(report.totalViolations).toBe(6);
	});

	it('skips a reference this installation does not have', async () => {
		const report = await auditWith(stubConnection({ 'NOT EXISTS': 5 }, { tables: ['unit', 'unit_category'] }));

		expect(report.findings).toEqual([]);
		expect(report.unchecked).toEqual([]);
		expect(report.skipped).toBeGreaterThan(0);
		expect(report.checked).toBe(0);
	});

	it('skips a reference whose column is absent even when its table is there', async () => {
		const report = await auditWith(
			stubConnection({ 'NOT EXISTS': 5 }, { columns: { spec_table: ['otherUnitId'] } })
		);

		expect(report.findings).toEqual([]);
		expect(report.checked).toBe(0);
	});

	it('reports a reference it could not evaluate rather than calling it clean', async () => {
		const report = await auditWith(stubConnection({ 'NOT EXISTS': new Error('no such column: unitId') }));

		expect(report.findings).toEqual([]);
		expect(report.unchecked).toHaveLength(1);
		expect(report.unchecked[0]).toMatchObject({ table: 'spec_table', column: 'unitId', owner: OWNER });
		expect(report.unchecked[0].reason).toContain('no such column: unitId');
		expect(report.clean).toBe(false);
	});

	it('reports every reference as unchecked when there is no connection', async () => {
		const report = await auditWith(stubConnection({}, { available: false }));

		expect(report.unchecked.length).toBe(report.declared);
		expect(report.unchecked.every((entry) => entry.reason === 'MEASUREMENT_AUDIT_NO_CONNECTION')).toBe(true);
		expect(report.checked).toBe(0);
	});

	it('audits only live rows when the table can be soft-deleted', async () => {
		const recorded: string[] = [];

		await auditWith(stubConnection({}, { recorded }));

		expect(recorded.every((sql) => sql.includes('"deletedAt" IS NULL'))).toBe(true);
	});

	it('audits every row when the table carries no soft-delete column', async () => {
		const recorded: string[] = [];

		await auditWith(
			stubConnection({}, { recorded, columns: { spec_table: ['unitId', 'otherUnitId'] } })
		);

		expect(recorded.some((sql) => sql.includes('deletedAt'))).toBe(false);
	});

	it('holds the audit to one statement per rule, whatever the row count', async () => {
		const recorded: string[] = [];

		await auditWith(stubConnection({ 'NOT EXISTS': 10_000 }, { recorded }));

		expect(recorded).toHaveLength(4);
	});

	it('returns a report even when nothing could be looked at', async () => {
		const report = await auditWith(stubConnection({}, { available: false }));

		expect(report.startedAt).toBeTruthy();
		expect(report.finishedAt).toBeTruthy();
		expect(report.declared).toBeGreaterThan(0);
	});
});

describe('the statements a unit reference produces', () => {
	const quote = (identifier: string) => `"${identifier}"`;

	it('always counts the rows naming a unit that does not exist', () => {
		const rules = buildReferenceRules(
			{ table: 'spec_table', column: 'unitId', owner: OWNER, description: '' },
			{ quote },
			false
		);

		expect(rules).toHaveLength(1);
		expect(rules[0].rule).toBe(ApiErrorCode.UNIT_REFERENCE_DANGLING);
		expect(rules[0].sql).toContain('FROM "spec_table" owner');
		expect(rules[0].sql).toContain('owner."unitId" IS NOT NULL');
		expect(rules[0].sql).toContain('NOT EXISTS (SELECT 1 FROM "unit" target');
	});

	it('builds the family rule only when the column states one', () => {
		const without = buildReferenceRules(
			{ table: 'spec_table', column: 'unitId', owner: OWNER, description: '' },
			{ quote },
			false
		);
		const withFamily = buildReferenceRules(FULLY_STATED, { quote }, false);

		expect(without.some((rule) => rule.sql.includes('family.'))).toBe(false);
		expect(withFamily.some((rule) => rule.sql.includes(`family."code" <> 'MASS'`))).toBe(true);
	});

	it('builds the sibling rule only when a sibling is named', () => {
		const without = buildReferenceRules(
			{ table: 'spec_table', column: 'unitId', owner: OWNER, description: '' },
			{ quote },
			false
		);
		const withSibling = buildReferenceRules(FULLY_STATED, { quote }, false);

		expect(without.some((rule) => rule.sql.includes('sibling'))).toBe(false);
		expect(withSibling.some((rule) => rule.sql.includes('own_family."id" <> sibling_family."id"'))).toBe(true);
	});

	it('builds the reference-unit rule only when the column requires one', () => {
		const without = buildReferenceRules(
			{ table: 'spec_table', column: 'unitId', owner: OWNER, description: '' },
			{ quote },
			false
		);
		const withReference = buildReferenceRules(FULLY_STATED, { quote }, false);

		expect(without.some((rule) => rule.sql.includes('isReference'))).toBe(false);
		expect(withReference.some((rule) => rule.sql.includes('target."isReference" IS NOT TRUE'))).toBe(true);
	});

	it('leaves soft-deleted rows in when the table has no soft-delete column', () => {
		const rules = buildReferenceRules(FULLY_STATED, { quote }, false);

		expect(rules.every((rule) => !rule.sql.includes('deletedAt'))).toBe(true);
	});

	it('excludes soft-deleted rows when the table has one', () => {
		const rules = buildReferenceRules(FULLY_STATED, { quote }, true);

		expect(rules.every((rule) => rule.sql.includes('owner."deletedAt" IS NULL'))).toBe(true);
	});

	it('quotes identifiers the way the connection does', () => {
		const rules = buildReferenceRules(
			FULLY_STATED,
			{ quote: (identifier: string) => `\`${identifier}\`` },
			false
		);

		expect(rules.every((rule) => !rule.sql.includes('"'))).toBe(true);
		expect(rules[0].sql).toContain('FROM `spec_table` owner');
	});

	it('escapes a family code rather than interpolating it', () => {
		const rules = buildReferenceRules(
			{ table: 'spec_table', column: 'unitId', owner: OWNER, category: "M'ASS", description: '' },
			{ quote },
			false
		);
		const familyRule = rules.find((rule) => rule.sql.includes('family.'));

		expect(familyRule?.sql).toContain(`<> 'M''ASS'`);
	});

	it('never writes a statement that could change a row', () => {
		const rules = buildReferenceRules(FULLY_STATED, { quote }, true);

		for (const rule of rules) {
			expect(rule.sql.toUpperCase()).not.toMatch(/\b(UPDATE|DELETE|INSERT|ALTER|DROP|TRUNCATE)\b/);
		}
	});
});

describe('reading a count out of a driver result', () => {
	it('reads a number', () => {
		expect(readCount([{ violations: 4 }])).toBe(4);
	});

	it('reads a decimal string, which is what one driver returns for a count', () => {
		expect(readCount([{ count: '12' }])).toBe(12);
	});

	it('reads a bare array of one value', () => {
		expect(readCount([[7]])).toBe(7);
	});

	it('reads nothing as zero', () => {
		expect(readCount([])).toBe(0);
		expect(readCount(undefined)).toBe(0);
		expect(readCount(null)).toBe(0);
	});

	it('reads a value that is not a number as zero rather than as NaN', () => {
		expect(readCount([{ violations: 'not a number' }])).toBe(0);
	});
});

describe('choosing the dialect to write for', () => {
	/** @param type The TypeORM connection type. @returns The connection. */
	function typeOrm(type: string): MeasurementAuditConnection {
		return new MeasurementAuditConnection({ options: { type } } as never, undefined);
	}

	it('reads PostgreSQL', () => {
		expect(typeOrm('postgres').dialect).toBe('postgres');
	});

	it('reads MySQL and MariaDB', () => {
		expect(typeOrm('mysql').dialect).toBe('mysql');
		expect(typeOrm('mariadb').dialect).toBe('mysql');
	});

	it('reads SQLite in both of its spellings', () => {
		expect(typeOrm('sqlite').dialect).toBe('sqlite');
		expect(typeOrm('better-sqlite3').dialect).toBe('sqlite');
	});

	it('quotes with the dialect it writes for', () => {
		expect(typeOrm('postgres').quote('warehouse_bin')).toBe('"warehouse_bin"');
		expect(typeOrm('mysql').quote('warehouse_bin')).toBe('`warehouse_bin`');
	});

	it('is unavailable with neither ORM', () => {
		const connection = new MeasurementAuditConnection(undefined, undefined);

		expect(connection.available).toBe(false);
	});
});
