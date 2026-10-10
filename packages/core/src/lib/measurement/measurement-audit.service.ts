import { Inject, Injectable, Logger } from '@nestjs/common';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { IMeasurementAuditConnection } from './measurement-audit.connection';
import { IUnitReference, registeredUnitReferences } from './unit-references';

/**
 * Token the audit's connection is injected under.
 *
 * A token rather than the class, because the audit depends on the narrow query surface and nothing
 * else: the adapter that reaches an ORM is one implementation of it, and a test supplies another.
 */
export const MEASUREMENT_AUDIT_CONNECTION = Symbol('MEASUREMENT_AUDIT_CONNECTION');

/** The kernel table a unit reference is resolved against. */
const UNIT_TABLE = 'unit';

/** The kernel table that states a unit's family. */
const UNIT_CATEGORY_TABLE = 'unit_category';

/** One rule a unit reference can break. */
export type MeasurementAuditRule = ApiErrorCode | string;

/** One rule, checked against one column, that found something. */
export interface IMeasurementAuditFinding {
	/** The table that owns the column. */
	readonly table: string;
	/** The column. */
	readonly column: string;
	/** The capability that declared the reference. */
	readonly owner: string;
	/** The rule that was broken. */
	readonly rule: MeasurementAuditRule;
	/** What the column means, so the finding reads without the registry open beside it. */
	readonly description: string;
	/** How many rows break it. */
	readonly violations: number;
}

/** One declared reference the audit could not check on this installation. */
export interface IUncheckedUnitReference {
	/** The table that owns the column. */
	readonly table: string;
	/** The column. */
	readonly column: string;
	/** The capability that declared the reference. */
	readonly owner: string;
	/** Why it could not be checked, in one line. */
	readonly reason: string;
}

/** What one audit run found. */
export interface IMeasurementAuditReport {
	/** When the run started, as an ISO instant. */
	readonly startedAt: string;
	/** When the run finished, as an ISO instant. */
	readonly finishedAt: string;
	/** How many references are declared. */
	readonly declared: number;
	/** How many rules were evaluated. */
	readonly checked: number;
	/** How many references were skipped because this installation does not have them. */
	readonly skipped: number;
	/** Every rule that found rows, worst first. */
	readonly findings: IMeasurementAuditFinding[];
	/** Every reference that could not be checked, with the reason. */
	readonly unchecked: IUncheckedUnitReference[];
	/** How many rows break a rule, summed over every finding. */
	readonly totalViolations: number;
	/** Whether every declared reference was checked and none broke a rule. */
	readonly clean: boolean;
}

/** Whether a declared reference exists on this installation at all. */
type ReferencePresence = 'present' | 'absent' | 'unknown';

/**
 * The audit of every declared unit reference.
 *
 * A constraint states a rule at the moment a row is written, and it is the right place for one — but
 * no dialect of this platform can express every rule a unit reference carries. A comparison between
 * a column of a row and a column of a table two joins away is not a `CHECK` on any of them, and
 * SQLite cannot attach a foreign key to a column that already exists without rebuilding the table it
 * belongs to — a rebuild that was measured to delete the rows it was meant to protect. Those rules
 * are therefore carried by the write path, which refuses the write, and by this audit, which reports
 * the rows that predate the rule or reached the table by a path the write path does not guard.
 *
 * The audit is **read-only and set-based**: one statement per rule per column, so its cost is a
 * function of the number of declared references rather than of the number of rows, and the rows only
 * decide how long each count takes. It never repairs anything. A nightly report that silently
 * rewrote rows would be a worse failure than the rows it found, because the value it invented is not
 * the tenant's.
 *
 * Three outcomes are kept apart deliberately, because collapsing any two of them turns the report
 * into a report nobody reads. A reference whose package is not installed is **skipped** and does not
 * appear at all. A reference that is installed and evaluated is **checked**, and appears only if it
 * broke a rule. A reference the audit could not evaluate — because the connection it was given
 * cannot answer, or because the database refused the statement — is **unchecked**, and appears with
 * the reason. "Nothing is wrong" and "we did not look" are not the same answer.
 */
@Injectable()
export class MeasurementAuditService {
	private readonly logger = new Logger(MeasurementAuditService.name);

	constructor(
		@Inject(MEASUREMENT_AUDIT_CONNECTION)
		private readonly connection: IMeasurementAuditConnection
	) {}

	/**
	 * Checks every declared unit reference.
	 *
	 * @returns The report. It is returned whether or not anything was found, and it is never thrown:
	 * a run that threw would leave the scheduler entry as the only evidence that it happened, and the
	 * findings would be lost with it.
	 */
	async audit(): Promise<IMeasurementAuditReport> {
		const startedAt = new Date().toISOString();
		const references = registeredUnitReferences();
		const findings: IMeasurementAuditFinding[] = [];
		const unchecked: IUncheckedUnitReference[] = [];
		let checked = 0;
		let skipped = 0;

		for (const reference of references) {
			const outcome = await this.checkReference(reference);

			if (outcome.skipped) {
				skipped++;
				continue;
			}

			if (outcome.unchecked) {
				unchecked.push({
					table: reference.table,
					column: reference.column,
					owner: reference.owner,
					reason: outcome.unchecked
				});
				continue;
			}

			checked += outcome.evaluated;
			findings.push(...outcome.findings);
		}

		findings.sort((left, right) => right.violations - left.violations);

		const report: IMeasurementAuditReport = {
			startedAt,
			finishedAt: new Date().toISOString(),
			declared: references.length,
			checked,
			skipped,
			findings,
			unchecked,
			totalViolations: findings.reduce((total, finding) => total + finding.violations, 0),
			clean: findings.length === 0 && unchecked.length === 0
		};

		this.report(report);

		return report;
	}

	/**
	 * Checks one declared reference.
	 *
	 * @param reference The reference.
	 * @returns Its findings, how many rules were evaluated, and whether it was skipped or could not
	 * be evaluated. A reference is exactly one of the three; it is never two of them at once, because
	 * a report that mixed them would make the states indistinguishable to whoever reads it.
	 */
	private async checkReference(
		reference: IUnitReference
	): Promise<{
		findings: IMeasurementAuditFinding[];
		evaluated: number;
		skipped?: boolean;
		unchecked?: string;
	}> {
		if (!this.connection.available) {
			return { findings: [], evaluated: 0, unchecked: 'MEASUREMENT_AUDIT_NO_CONNECTION' };
		}

		const presence = await this.presence(reference);

		if (presence === 'absent') {
			return { findings: [], evaluated: 0, skipped: true };
		}

		const rules = buildReferenceRules(reference, this.connection, await this.isSoftDeletable(reference.table));
		const findings: IMeasurementAuditFinding[] = [];
		let evaluated = 0;

		for (const rule of rules) {
			let violations: number;

			try {
				violations = await this.connection.count(rule.sql);
			} catch (error) {
				return { findings: [], evaluated: 0, unchecked: describe(error) };
			}

			evaluated++;

			if (violations > 0) {
				findings.push({
					table: reference.table,
					column: reference.column,
					owner: reference.owner,
					rule: rule.rule,
					description: reference.description,
					violations
				});
			}
		}

		return { findings, evaluated };
	}

	/**
	 * Whether this installation has the reference at all.
	 *
	 * A table the catalogue reports as absent is the ordinary case of a package that is not
	 * installed. A catalogue that cannot answer — an ORM whose existence probes this adapter does not
	 * implement — yields `unknown`, and the reference is then evaluated and its own failure reported,
	 * which is strictly better than guessing that it is absent and silently auditing nothing.
	 *
	 * @param reference The reference.
	 * @returns The presence.
	 */
	private async presence(reference: IUnitReference): Promise<ReferencePresence> {
		const table = await this.connection.hasTable(reference.table);

		if (table === false) {
			return 'absent';
		}

		if (await this.connection.hasTable(UNIT_TABLE) === false) {
			return 'absent';
		}

		if (table === undefined) {
			return 'unknown';
		}

		return (await this.connection.hasColumn(reference.table, reference.column)) === false ? 'absent' : 'present';
	}

	/**
	 * Whether the owning table carries a soft-delete column.
	 *
	 * Read from the catalogue rather than assumed, because the filter is only correct on a table that
	 * has the column: on one that does not, adding it would turn every rule into a statement the
	 * database refuses, and the reference would be reported as unchecked for a reason that is the
	 * audit's own doing. When the catalogue cannot say, the filter is left out and every row is
	 * audited — the answer is then stricter, never wrong.
	 *
	 * @param table The table.
	 * @returns True when the table is known to carry `deletedAt`.
	 */
	private async isSoftDeletable(table: string): Promise<boolean> {
		return (await this.connection.hasColumn(table, 'deletedAt')) === true;
	}

	/**
	 * Writes one line about the run.
	 *
	 * A clean run is logged at debug rather than at log: it happens every night, and a line a night
	 * saying nothing happened is how a log grows a section nobody reads. A run with findings or with
	 * unchecked references is logged as a warning, because both are states somebody has to act on —
	 * one to correct the rows, the other to restore the audit's ability to look.
	 *
	 * @param report The report.
	 */
	private report(report: IMeasurementAuditReport): void {
		if (report.clean) {
			this.logger.debug(
				`The measurement audit checked ${report.checked} unit reference rule(s) over ` +
					`${report.declared} declared reference(s); nothing was found.`
			);
			return;
		}

		const detail = report.findings
			.map((finding) => `${finding.table}.${finding.column} breaks ${finding.rule} in ${finding.violations} row(s)`)
			.concat(report.unchecked.map((entry) => `${entry.table}.${entry.column} could not be checked: ${entry.reason}`))
			.join('; ');

		this.logger.warn(
			`The measurement audit found ${report.totalViolations} row(s) breaking a unit reference and ` +
				`could not check ${report.unchecked.length} reference(s): ${detail}`
		);
	}
}

/** One rule, as the statement that counts the rows breaking it. */
export interface IUnitReferenceRule {
	/** The rule's code. */
	readonly rule: MeasurementAuditRule;
	/** The statement that counts the rows breaking it. */
	readonly sql: string;
}

/**
 * Builds the statements that count the rows breaking each rule for one reference.
 *
 * Pure, and exported, so the statements can be read and asserted without a database: the rules are
 * the part of the audit that has to be right, and a test that needs three dialects, two ORMs and a
 * populated schema to look at a `WHERE` clause is a test nobody runs.
 *
 * Every rule counts rows that **name a unit** — a null column is a column that was never filled in,
 * which is a different report's business. The dangling rule is always built; the other two are built
 * only when the reference declares the requirement they state, because a rule nobody declared is a
 * rule whose failure would be reported against a column that was never meant to satisfy it.
 *
 * @param reference The reference.
 * @param connection The connection, for its dialect and its quoter.
 * @param softDeletable Whether the owning table carries `deletedAt`.
 * @returns The rules, in the order they are evaluated.
 */
export function buildReferenceRules(
	reference: IUnitReference,
	connection: Pick<IMeasurementAuditConnection, 'quote'>,
	softDeletable: boolean
): IUnitReferenceRule[] {
	const q = (identifier: string) => connection.quote(identifier);
	const table = q(reference.table);
	const column = `owner.${q(reference.column)}`;
	const unit = q(UNIT_TABLE);
	const category = q(UNIT_CATEGORY_TABLE);

	// Only live rows are audited when the table has a soft-delete column: a row the tenant deleted is
	// not a row the tenant is still trading on, and a report that never goes quiet is a report nobody
	// reads.
	const live = softDeletable ? ` AND owner.${q('deletedAt')} IS NULL` : '';

	const rules: IUnitReferenceRule[] = [
		{
			rule: ApiErrorCode.UNIT_REFERENCE_DANGLING,
			sql:
				`SELECT COUNT(*) AS violations FROM ${table} owner ` +
				`WHERE ${column} IS NOT NULL${live} ` +
				`AND NOT EXISTS (SELECT 1 FROM ${unit} target WHERE target.${q('id')} = ${column})`
		}
	];

	if (reference.category) {
		rules.push({
			rule: ApiErrorCode.UNIT_CATEGORY_MISMATCH,
			sql:
				`SELECT COUNT(*) AS violations FROM ${table} owner ` +
				`JOIN ${unit} target ON target.${q('id')} = ${column} ` +
				`JOIN ${category} family ON family.${q('id')} = target.${q('categoryId')} ` +
				`WHERE ${column} IS NOT NULL${live} ` +
				`AND family.${q('code')} <> ${literal(reference.category)}`
		});
	}

	if (reference.sameCategoryAs) {
		const sibling = `owner.${q(reference.sameCategoryAs)}`;

		rules.push({
			rule: ApiErrorCode.UNIT_CATEGORY_MISMATCH,
			sql:
				`SELECT COUNT(*) AS violations FROM ${table} owner ` +
				`JOIN ${unit} target ON target.${q('id')} = ${column} ` +
				`JOIN ${unit} sibling ON sibling.${q('id')} = ${sibling} ` +
				`JOIN ${category} own_family ON own_family.${q('id')} = target.${q('categoryId')} ` +
				`JOIN ${category} sibling_family ON sibling_family.${q('id')} = sibling.${q('categoryId')} ` +
				`WHERE ${column} IS NOT NULL AND ${sibling} IS NOT NULL${live} ` +
				`AND own_family.${q('id')} <> sibling_family.${q('id')}`
		});
	}

	if (reference.referenceUnit) {
		rules.push({
			rule: ApiErrorCode.STOCK_UNIT_NOT_REFERENCE,
			sql:
				`SELECT COUNT(*) AS violations FROM ${table} owner ` +
				`JOIN ${unit} target ON target.${q('id')} = ${column} ` +
				`WHERE ${column} IS NOT NULL${live} ` +
				`AND target.${q('isReference')} IS NOT TRUE`
		});
	}

	return rules;
}

/**
 * Renders a string as a SQL literal.
 *
 * The value comes from the registry, which is code rather than a request, and it is still written
 * through one function instead of being interpolated at each site: the day a registry entry is
 * populated from data, there is exactly one place to change.
 *
 * @param value The value.
 * @returns The literal, with any quote in it doubled.
 */
function literal(value: string): string {
	return `'${value.replace(/'/g, "''")}'`;
}

/**
 * @param error The failure.
 * @returns A one-line description, since a driver's message runs to several lines and the report is
 * read as one.
 */
function describe(error: unknown): string {
	return error instanceof Error ? error.message.split('\n')[0] : String(error);
}
