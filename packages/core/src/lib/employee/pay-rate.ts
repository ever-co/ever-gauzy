import { EntityManager, FindOptionsWhere, In } from 'typeorm';
import { CurrenciesEnum, ID, IEmployeeUpdateInput, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { EMPLOYEE_PAY_RATE_KEYS } from '../core/interceptors/employee-pay-rate-scrub';
import { Employee } from './employee.entity';
import { isSameId } from './own-rates';

/**
 * An employee's pay rate as stored. Both columns are left out of every generic read (`select: false`, MikroORM
 * `hidden`), so they are read here, by name, through the TypeORM data source that runs under both ORMs.
 */
export interface StoredPayRate {
	id: ID;
	payRateValue: number | string | null;
	payRateCurrency: CurrenciesEnum | null;
}

type Rate = number | string | null | undefined;

/**
 * The caller's own employee. `RequestContext.currentEmployeeId()` answers null to a holder of
 * CHANGE_SELECTED_EMPLOYEE, whose own employee is still the one of their user.
 */
export function callerEmployeeId(): ID | null {
	const contextEmployeeId = RequestContext.currentEmployeeId();
	if (contextEmployeeId) {
		return contextEmployeeId;
	}
	return RequestContext.currentUser()?.employeeId ?? null;
}

/** Whether the caller sets and reads every employee's pay rate. */
export function readsEveryPayRate(): boolean {
	return RequestContext.hasPermission(PermissionsEnum.ORG_EMPLOYEES_EDIT);
}

/**
 * An edit of one's own record made without CHANGE_OWN_RATES, without its pay rate fields. They passed the own pay
 * rate check only unchanged, and writing them back could undo a pay rate a rate editor changed meanwhile.
 */
export function withoutOwnPayRateWrite<T extends object>(employeeId: ID, input: T): T {
	const isOwnRecord = isSameId(callerEmployeeId(), employeeId);
	const changesOwnRates = RequestContext.hasPermission(PermissionsEnum.CHANGE_OWN_RATES);
	const keepsStoredPayRate = isOwnRecord && !changesOwnRates;
	if (!keepsStoredPayRate) {
		return input;
	}
	return withoutPayRateKeys(input) as T;
}

/** Whether the caller may read this employee's pay rate: their own, or anyone's for a rate editor. */
export function mayReadPayRateOf(employeeId: ID): boolean {
	const isOwnRecord = isSameId(callerEmployeeId(), employeeId);
	return isOwnRecord || readsEveryPayRate();
}

export function isPayRateSet(rate: Rate): boolean {
	const isMissing = rate === null || rate === undefined;
	return !isMissing;
}

/**
 * The stored pay rates of the given employees of the tenant (and of the organization, when one is given).
 *
 * @param manager The TypeORM entity manager.
 * @returns One row per employee found, with its pay rate and currency, empty or not.
 */
export async function findStoredPayRates(
	manager: EntityManager,
	employeeIds: ID[],
	tenantId: ID,
	organizationId?: ID
): Promise<StoredPayRate[]> {
	if (employeeIds.length === 0) {
		return [];
	}
	const where: FindOptionsWhere<Employee> = { id: In(employeeIds), tenantId };
	if (organizationId) {
		where.organizationId = organizationId;
	}
	const rows = await manager.find(Employee, {
		where,
		select: { id: true, payRateValue: true, payRateCurrency: true }
	});
	return rows.map((row) => ({
		id: row.id,
		payRateValue: row.payRateValue ?? null,
		payRateCurrency: row.payRateCurrency ?? null
	}));
}

function sameRate(stored: Rate, sent: Rate): boolean {
	const storedIsSet = isPayRateSet(stored);
	const sentIsSet = isPayRateSet(sent);
	if (!storedIsSet || !sentIsSet) {
		return storedIsSet === sentIsSet;
	}
	return Number(stored) === Number(sent);
}

function sameCurrency(stored: string | null | undefined, sent: string | null | undefined): boolean {
	const storedCurrency = stored || null;
	const sentCurrency = sent || null;
	return storedCurrency === sentCurrency;
}

/**
 * Whether an edit would change the stored pay rate. A field the edit leaves out changes nothing, and a value sent
 * again as it is stored (a profile form that posts every field) changes nothing either.
 */
export function changesPayRate(stored: StoredPayRate | undefined, input: IEmployeeUpdateInput): boolean {
	const sendsRate = input.payRateValue !== undefined;
	const sendsCurrency = input.payRateCurrency !== undefined;
	const rateChanges = sendsRate && !sameRate(stored?.payRateValue, input.payRateValue);
	const currencyChanges = sendsCurrency && !sameCurrency(stored?.payRateCurrency, input.payRateCurrency);
	return rateChanges || currencyChanges;
}

interface EmployeeQueryOptions {
	select?: unknown;
	where?: unknown;
	order?: unknown;
}

/** The criteria without any pay rate key at their own level, each branch of an either-or included. */
export function withoutPayRateKeys(criteria: unknown): unknown {
	const isObject = typeof criteria === 'object' && criteria !== null;
	if (!isObject) {
		return criteria;
	}
	if (Array.isArray(criteria)) {
		// A `select` may be a list of property names (`?select[]=payRateValue`)
		const isPayRateKey = (item: unknown) => typeof item === 'string' && EMPLOYEE_PAY_RATE_KEYS.includes(item);
		return criteria.filter((item) => !isPayRateKey(item)).map((item) => withoutPayRateKeys(item));
	}
	const kept = { ...(criteria as Record<string, unknown>) };
	for (const key of EMPLOYEE_PAY_RATE_KEYS) {
		delete kept[key];
	}
	return kept;
}

/**
 * The options of a generic employee list without any pay rate in its select, filter or sort. A filter or a sort on
 * the pay rate would answer by which employees it returns, or in which order, what the rows never show.
 */
export function withoutPayRateCriteria<T extends EmployeeQueryOptions>(options: T): T {
	const cleaned = { ...options };
	if (options.select !== undefined) {
		cleaned.select = withoutPayRateKeys(options.select) as T['select'];
	}
	if (options.where !== undefined) {
		cleaned.where = withoutPayRateKeys(options.where) as T['where'];
	}
	if (options.order !== undefined) {
		cleaned.order = withoutPayRateKeys(options.order) as T['order'];
	}
	return cleaned;
}
