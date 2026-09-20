import { In, Repository } from 'typeorm';
import { IActivity, ID } from '@gauzy/contracts';

/**
 * Relation objects a client-supplied activity must not carry into a save: each one would let the
 * body re-point the row at another tenant, organization, employee or time slot, overriding the
 * scalar ids the handler forces.
 */
const FORCED_RELATION_KEYS = ['tenant', 'organization', 'employee', 'timeSlot'] as const;

export interface IActivityWriteScope {
	tenantId: ID;
	employeeId: ID;
}

/**
 * Prepares client-supplied activities for `repository.save()`.
 *
 * `save()` upserts by primary key alone, so an activity that kept a body-supplied `id` overwrote —
 * and re-parented — whatever Activity row carried that UUID, in any tenant (GHSA-6qvm-3wg4-26w4,
 * PUT /timesheet/time-slot/:id and POST /timesheet/activity/bulk). This keeps an `id` only when it
 * names an activity of the same tenant AND employee (a re-sent activity still updates in place); any
 * other id is dropped so the row is inserted as new. A `timeSlotId` that is not a slot of the same
 * tenant and employee is dropped as well.
 *
 * Mutates and returns the given activities. The caller still forces tenantId / organizationId /
 * employeeId.
 *
 * @param activities - The activities about to be saved.
 * @param repository - The TypeORM Activity repository.
 * @param scope - The tenant and employee the activities are written for.
 */
export async function scopeActivitiesForWrite<T extends IActivity>(
	activities: T[],
	repository: Repository<any>,
	scope: IActivityWriteScope
): Promise<T[]> {
	const { tenantId, employeeId } = scope;

	for (const activity of activities) {
		for (const key of FORCED_RELATION_KEYS) {
			delete (activity as any)[key];
		}
	}

	const ids = unique(activities.map((activity) => activity.id));
	const ownIds = await findOwnIds(repository, ids, tenantId, employeeId);

	const timeSlotIds = unique(activities.map((activity) => activity.timeSlotId));
	const timeSlotTarget = repository.metadata?.findRelationWithPropertyPath('timeSlot')?.inverseEntityMetadata?.target;
	const ownTimeSlotIds =
		timeSlotTarget && timeSlotIds.length
			? await findOwnIds(repository.manager.getRepository(timeSlotTarget), timeSlotIds, tenantId, employeeId)
			: new Set<string>();

	for (const activity of activities) {
		if (activity.id && !ownIds.has(idKey(activity.id))) {
			delete activity.id;
		}
		if (activity.timeSlotId && !ownTimeSlotIds.has(idKey(activity.timeSlotId))) {
			delete activity.timeSlotId;
		}
	}

	return activities;
}

/**
 * Returns which of the given ids name a row of the tenant and employee (soft-deleted rows included,
 * since `save()` would reach those too). Fails closed without a tenant or an employee.
 */
async function findOwnIds(repository: Repository<any>, ids: ID[], tenantId: ID, employeeId: ID): Promise<Set<string>> {
	if (!ids.length || !tenantId || !employeeId) {
		return new Set<string>();
	}
	const rows = await repository.find({
		where: { id: In(ids), tenantId, employeeId },
		select: { id: true },
		withDeleted: true
	});
	return new Set(rows.map((row: { id: ID }) => idKey(row.id)));
}

/**
 * Postgres renders `uuid` lower case and MySQL compares ids case-insensitively, so the row a
 * differently-cased id resolves to is the same row; compare the ids the same way.
 */
function idKey(id: ID): string {
	return String(id).toLowerCase();
}

function unique(values: Array<ID | null | undefined>): ID[] {
	return [...new Set(values.filter((value): value is ID => !!value))];
}
