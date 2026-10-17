import { ID } from '@gauzy/contracts';

/**
 * An employee's copy of a job preset criterion: the criterion's values, for the employee, as a NEW row.
 *
 * The preset criterion's own `id` (and timestamps) used to be copied as well, so the second employee
 * saving the same preset did not insert rows: `save()` found the first employee's rows by that id and
 * moved them to the second employee, who silently took over the first one's criteria.
 */
export function presetCriterionForEmployee<T extends { id?: ID; createdAt?: Date; updatedAt?: Date; deletedAt?: Date }>(
	criterion: T,
	employeeId: ID
): Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> & { employeeId: ID } {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { id, createdAt, updatedAt, deletedAt, ...values } = criterion;
	return { ...values, employeeId };
}
