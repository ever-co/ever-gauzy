import { Brackets, WhereExpressionBuilder } from 'typeorm';
import { IUser, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';

export type RecordedClause = {
	condition: unknown;
	parameters?: Record<string, unknown>;
	/** Predicates a `Brackets` factory attached, captured when the brackets were added. */
	nested?: RecordedClause[];
};

/**
 * Stand-in for TypeORM's SelectQueryBuilder that keeps only what the time-tracking specs depend
 * on: `where(callback)` clears the clause list and runs the callback synchronously (typeorm
 * `SelectQueryBuilder.where` -> `QueryBuilder.getWhereCondition`), a `Brackets` factory runs
 * against a nested builder as soon as the brackets are added, and the terminal calls render
 * whatever clauses exist at that instant. A filter added by a promise still pending when the
 * query executes never reaches the SQL, which is the defect these specs guard against.
 */
export class RecordingQueryBuilder {
	/** Clauses present when the query executed, i.e. the ones that would have reached the SQL. */
	executedClauses: RecordedClause[] | null = null;
	/**
	 * Rows `getMany()` hands back. Empty by default, because the filter specs only care about the
	 * clauses; set it when a spec needs the report body — which only runs over a non-empty result — to
	 * execute.
	 */
	rows: unknown[] = [];
	/** The joins added so far, by alias, as `SelectQueryBuilder.expressionMap.joinAttributes` lists them. */
	readonly expressionMap: { joinAttributes: Array<{ alias: { name: string } }> } = { joinAttributes: [] };
	private clauses: RecordedClause[] = [];
	/** Parameters a sub-query bound while a condition callback ran; attached to that condition's clause. */
	private subQueryParameters: Record<string, unknown> = {};

	constructor(readonly alias: string) {}

	innerJoin(_target?: unknown, alias?: string): this {
		if (alias) {
			this.expressionMap.joinAttributes.push({ alias: { name: alias } });
		}
		return this;
	}

	setFindOptions(): this {
		return this;
	}

	/** A sub-query whose SQL a condition callback embeds (`EXISTS (...)`, `IN (...)`), like typeorm's `subQuery()`. */
	subQuery(): RecordingSubQuery {
		return new RecordingSubQuery(this);
	}

	/** Called by a sub-query for each parameter it binds; typeorm binds them on the parent query the same way. */
	setParameter(key: string, value: unknown): this {
		this.subQueryParameters[key] = value;
		return this;
	}

	where(where: unknown, parameters?: Record<string, unknown>): this {
		this.clauses = [];
		if (typeof where === 'function') {
			where(this);
		} else {
			this.clauses.push(this.record(where, parameters));
		}
		return this;
	}

	andWhere(condition: unknown, parameters?: Record<string, unknown>): this {
		if (typeof condition === 'function') {
			// typeorm runs a condition callback at once and uses the SQL it returns (`getWhereCondition`).
			this.subQueryParameters = {};
			const sql = condition(this);
			this.clauses.push(this.record(sql, { ...this.subQueryParameters, ...(parameters ?? {}) }));
			return this;
		}
		this.clauses.push(this.record(condition, parameters));
		return this;
	}

	async getCount(): Promise<number> {
		this.executedClauses = [...this.clauses];
		return 0;
	}

	async getMany(): Promise<unknown[]> {
		this.executedClauses = [...this.clauses];
		return this.rows;
	}

	private record(condition: unknown, parameters?: Record<string, unknown>): RecordedClause {
		if (condition instanceof Brackets) {
			const nested = new RecordingQueryBuilder(this.alias);
			// The double only implements the where/andWhere subset the factories use.
			condition.whereFactory(nested as unknown as WhereExpressionBuilder);
			return { condition, nested: nested.clauses };
		}
		return { condition, parameters };
	}
}

/**
 * The sub-query double: renders the SELECT it is given as one line of SQL (`getQuery()` answers it in
 * parentheses, as typeorm does for a sub-query) and binds its parameters on the parent builder.
 */
/**
 * The entity manager's query builder as `TimeLogService.loadTimeSlotFigures` uses it: every chained call returns the
 * stub, and `getRawMany` answers the slot figures of the given logs (one row per slot of each log's `timeSlots`, as
 * the junction query would). Hand it to a mocked repository as `manager.createQueryBuilder`.
 */
export function slotFiguresQueryBuilder(logs: () => unknown[]) {
	const stub: Record<string, unknown> = {};
	for (const method of ['select', 'addSelect', 'from', 'innerJoin', 'where', 'andWhere', 'orderBy', 'addOrderBy']) {
		stub[method] = () => stub;
	}
	stub.getRawMany = async () =>
		(logs() as Array<{ id: string; timeSlots?: Array<{ id: string; overall: number; duration: number }> }>).flatMap(
			(log) => (log.timeSlots ?? []).map((slot) => ({ timeLogId: log.id, id: slot.id, overall: slot.overall, duration: slot.duration }))
		);
	return stub;
}

export class RecordingSubQuery {
	private selection = '';
	private source = '';
	private readonly joins: string[] = [];
	private readonly conditions: string[] = [];

	constructor(private readonly parent: RecordingQueryBuilder) {}

	select(selection: string): this {
		this.selection = selection;
		return this;
	}

	from(table: string, alias: string): this {
		this.source = `${table} ${alias}`;
		return this;
	}

	innerJoin(table: string, alias: string, condition: string): this {
		this.joins.push(`INNER JOIN ${table} ${alias} ON ${condition}`);
		return this;
	}

	where(condition: string, parameters?: Record<string, unknown>): this {
		return this.andWhere(condition, parameters);
	}

	andWhere(condition: string, parameters?: Record<string, unknown>): this {
		this.conditions.push(condition);
		for (const [key, value] of Object.entries(parameters ?? {})) {
			this.parent.setParameter(key, value);
		}
		return this;
	}

	distinct(): this {
		return this;
	}

	getQuery(): string {
		const where = this.conditions.length ? ` WHERE ${this.conditions.join(' AND ')}` : '';
		return `(SELECT ${this.selection} FROM ${this.source}${this.joins.map((join) => ` ${join}`).join('')}${where})`;
	}
}

/**
 * Clauses in place when the query executed, with the predicates of every `Brackets` flattened in
 * after their brackets. String conditions are normalised to double quotes so the assertions hold
 * whatever quoting the database helper applied; other conditions (e.g. `Brackets`) are reported
 * by their class name. `clauses` keeps the raw entries for object-literal predicates.
 */
export function executedFilters(builder: RecordingQueryBuilder): {
	conditions: string[];
	parameters: Record<string, unknown>;
	clauses: RecordedClause[];
} {
	if (!builder.executedClauses) {
		throw new Error('The query was never executed');
	}
	const flatten = (clauses: RecordedClause[]): RecordedClause[] =>
		clauses.flatMap((clause) => (clause.nested ? [clause, ...flatten(clause.nested)] : [clause]));
	const clauses = flatten(builder.executedClauses);
	return {
		conditions: clauses.map(({ condition }) =>
			typeof condition === 'string' ? condition.replace(/`/g, '"') : (condition as object).constructor.name
		),
		parameters: Object.assign({}, ...clauses.map(({ parameters }) => parameters ?? {})),
		clauses
	};
}

/** Spies the RequestContext statics the filter helpers read: tenant, current user and permission check. */
export function mockRequestContext(caller: {
	tenantId: string;
	user: Pick<IUser, 'id' | 'employeeId'>;
	canChangeSelectedEmployee: boolean;
}): void {
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(caller.tenantId);
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue(caller.user as IUser);
	jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
		(permission) => caller.canChangeSelectedEmployee && permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
	);
}

/** Resolves on a later macrotask, like a repository round-trip, to place an async boundary inside a mocked call. */
export function nextMacrotask(): Promise<void> {
	return new Promise((resolve) => setImmediate(resolve));
}
