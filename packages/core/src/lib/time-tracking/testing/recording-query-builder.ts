import { IUser, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';

export type RecordedClause = { condition: unknown; parameters?: Record<string, unknown> };

/**
 * Stand-in for TypeORM's SelectQueryBuilder that keeps only what the time-tracking specs depend
 * on: `where(callback)` clears the clause list and runs the callback synchronously (typeorm
 * `SelectQueryBuilder.where` -> `QueryBuilder.getWhereCondition`), and the terminal calls render
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
			this.clauses.push({ condition: where, parameters });
		}
		return this;
	}

	andWhere(condition: unknown, parameters?: Record<string, unknown>): this {
		this.clauses.push({ condition, parameters });
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
}

/**
 * Clauses and merged parameters in place when the query executed. String conditions are
 * normalised to double quotes so the assertions hold whatever quoting the database helper
 * applied; other conditions (e.g. `Brackets`) are reported by their class name.
 */
export function executedFilters(builder: RecordingQueryBuilder): {
	conditions: string[];
	parameters: Record<string, unknown>;
} {
	if (!builder.executedClauses) {
		throw new Error('The query was never executed');
	}
	return {
		conditions: builder.executedClauses.map(({ condition }) =>
			typeof condition === 'string' ? condition.replace(/`/g, '"') : (condition as object).constructor.name
		),
		parameters: Object.assign({}, ...builder.executedClauses.map(({ parameters }) => parameters ?? {}))
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
