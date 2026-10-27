import { DatabaseTypeEnum, getConfig } from '@gauzy/config';
import { getORMType, MultiORMEnum, replacePlaceholders } from '../core/utils';
import {
	MikroOrmEntityManager,
	MultiOrmEntityManager,
	TypeOrmEntityManager
} from '../core/entities/subscribers/entity-event-subscriber.types';
import { prepareSQLQuery as p } from '../database/database.helper';

/**
 * The SQL condition on the joined `employee` row that keeps a project member in its project's `membersCount`:
 * an employee who still works in the organization. "End Work" deactivates and archives the employee
 * (EmployeeSubscriber) but keeps their project memberships, so that "Back to Work" restores them; until then
 * they are no longer counted, nor listed (`OrganizationProjectService`).
 *
 * `TRUE` / `FALSE` are literals rather than bound values: better-sqlite3 refuses to bind a boolean, and
 * Postgres, MySQL and SQLite (3.23+) all read the literals.
 */
export const WORKING_EMPLOYEE_SQL_CONDITION = `
	"employee"."isActive" = TRUE AND
	"employee"."isArchived" = FALSE AND
	"employee"."deletedAt" IS NULL
`;

/**
 * The working members of one project, correlated to the `organization_project` row being updated.
 */
export const WORKING_MEMBERS_COUNT_SUBQUERY = `
	SELECT COUNT(*) FROM "organization_project_employee"
	INNER JOIN "employee" ON "employee"."id" = "organization_project_employee"."employeeId"
	WHERE
		"organization_project_employee"."organizationProjectId" = "organization_project"."id" AND
		${WORKING_EMPLOYEE_SQL_CONDITION}
`;

/**
 * Recounts `membersCount` of every project the employee is a member of.
 *
 * Called when the employee's working status changes (End Work, Back to Work, a new start date): the count of
 * each of their projects includes them or not from then on, without waiting for the project to be saved. The
 * projects are the ones the employee's own membership rows name, so the statement never reaches another tenant.
 *
 * @param em - The entity manager of the write, so the recount reads the employee row it has just updated.
 * @param employeeId - The employee whose projects are recounted.
 */
export async function recountMembersOfEmployeeProjects(
	em: MultiOrmEntityManager | undefined,
	employeeId: string
): Promise<void> {
	if (!em || !employeeId) {
		return;
	}

	const dbType = getConfig().dbConnectionOptions.type as DatabaseTypeEnum;
	const query = replacePlaceholders(
		p(`
			UPDATE "organization_project"
			SET "membersCount" = (${WORKING_MEMBERS_COUNT_SUBQUERY})
			WHERE "organization_project"."id" IN (
				SELECT "organizationProjectId" FROM "organization_project_employee"
				WHERE "organization_project_employee"."employeeId" = $1
			)
		`),
		dbType
	);

	const ormType = getORMType();
	if (ormType === MultiORMEnum.TypeORM && em instanceof TypeOrmEntityManager) {
		await em.query(query, [employeeId]);
	} else if (ormType === MultiORMEnum.MikroORM && em instanceof MikroOrmEntityManager) {
		await em.getConnection().execute(query.replace(/\$\d/g, '?'), [employeeId]);
	}
}
