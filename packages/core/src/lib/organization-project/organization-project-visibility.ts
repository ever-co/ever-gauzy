import { And, Equal, FindOperator, In, IsNull, Not } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { MultiORM, MultiORMEnum } from '../core/utils';

/** A project as the visibility rule reads it: its id and its memberships, managers included, under either ORM. */
export interface IProjectWithMemberships {
	id?: ID;
	members?: Array<{ employeeId?: ID; employee?: { id?: ID } | ID }>;
}

/**
 * The employee of a membership. TypeORM answers its `employeeId` column; MikroORM maps that column through the
 * `employee` relation and leaves `employeeId` unset on a loaded row, so the relation is read too.
 */
function membershipEmployeeId(member: { employeeId?: ID; employee?: { id?: ID } | ID }): ID | undefined {
	const employee = member?.employee;
	return member?.employeeId ?? (typeof employee === 'string' ? employee : employee?.id);
}

/**
 * The private projects a caller may not see: those of which they are neither a member nor a manager. Managers are
 * memberships with `isManager`, so one membership of any kind lets them see the project.
 *
 * @param privateProjects - The private projects (`public` false) of the organizations that keep them private, read
 * with their memberships.
 * @param employeeId - The caller's employee, or none for a user without one, who is a member of no project.
 * @returns The ids of the projects to leave out of the caller's reads.
 */
export function hiddenProjectIdsOf(
	privateProjects: IProjectWithMemberships[],
	employeeId: ID | null | undefined
): ID[] {
	const hidden = new Set<ID>();
	for (const project of privateProjects ?? []) {
		if (!project?.id) {
			continue;
		}
		const isMember =
			!!employeeId && (project.members ?? []).some((member) => membershipEmployeeId(member) === employeeId);
		if (!isMember) {
			hidden.add(project.id);
		}
	}
	return [...hidden];
}

/**
 * A read's conditions, with the hidden projects left out.
 *
 * Nothing is hidden (no organization keeps its private projects private, or the caller may see them all): the
 * conditions come back as they came, the same object, so the read runs exactly as it did before the setting.
 *
 * TypeORM is handed the condition on `id` beside the caller's own one, never over it: `And(<stated>, Not(In(hidden)))`.
 * MikroORM is handed `{ id: { $nin: hidden } }` in the entity-level `$and`, which the translation of the caller's
 * criteria keeps as it is (as the organization boundary of the CRUD service does).
 *
 * @param where - The read's conditions: one object, alternatives (an array), or none.
 * @param hidden - The projects to leave out.
 * @param ormType - The ORM the read runs on.
 * @returns The conditions the read runs with.
 */
export function whereWithoutHiddenProjects<W>(where: W, hidden: ID[], ormType: MultiORM): W {
	if (!hidden?.length) {
		return where;
	}
	if (Array.isArray(where)) {
		// Alternatives: each one leaves the hidden projects out. An empty list is no condition at all.
		if (!where.length) {
			return whereWithoutHiddenProjects(undefined, hidden, ormType) as unknown as W;
		}
		return where.map((condition) => whereWithoutHiddenProjects(condition, hidden, ormType)) as unknown as W;
	}

	const conditions = { ...((where ?? {}) as Record<string, unknown>) };

	if (ormType === MultiORMEnum.MikroORM) {
		const conjunction = conditions['$and'];
		conditions['$and'] = [
			...(conjunction === undefined ? [] : Array.isArray(conjunction) ? conjunction : [conjunction]),
			{ id: { $nin: hidden } }
		];
		return conditions as W;
	}

	const visible = Not(In(hidden));
	const stated = conditions['id'];
	conditions['id'] =
		stated === undefined
			? visible
			: And(stated instanceof FindOperator ? stated : stated === null ? IsNull() : Equal(stated), visible);
	return conditions as W;
}
