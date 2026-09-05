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
	private clauses: RecordedClause[] = [];

	constructor(readonly alias: string) {}

	innerJoin(): this {
		return this;
	}

	setFindOptions(): this {
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
		this.clauses.push(this.record(condition, parameters));
		return this;
	}

	async getCount(): Promise<number> {
		this.executedClauses = [...this.clauses];
		return 0;
	}

	async getMany(): Promise<never[]> {
		this.executedClauses = [...this.clauses];
		return [];
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
