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
 * The employee's projects, locked in id order (Postgres and MySQL).
 *
 * Two members of one project whose work ends at the same instant are recounted by two transactions. Under READ
 * COMMITTED the second `UPDATE … SET "membersCount" = (subquery)` waits for the first transaction's lock on the
 * project row, then re-checks the row but evaluates the subquery on the snapshot it took before the first one
 * committed, so it still counts the first member: the count ends one too high. Taking the row locks in a statement
 * of their own first means the `UPDATE` that follows starts after the other transaction committed, and sees it. The
 * id order keeps two employees who share several projects from locking them in opposite orders (a deadlock).
 */
const LOCK_EMPLOYEE_PROJECTS = `
	SELECT "organization_project"."id" FROM "organization_project"
	WHERE "organization_project"."id" IN (
		SELECT "organizationProjectId" FROM "organization_project_employee"
		WHERE "organization_project_employee"."employeeId" = $1
	)
	ORDER BY "organization_project"."id"
	FOR UPDATE
`;

/**
 * Recounts `membersCount` of every project the employee is a member of.
 *
 * Called when the employee's working status changes (End Work, Back to Work, a new start date, an edit of
 * `isActive` / `isArchived`, a soft delete or its recovery): the count of each of their projects includes them or
 * not from then on, without waiting for the project to be saved. The
 * projects are the ones the employee's own membership rows name, so the statement never reaches another tenant.
 *
 * On Postgres and MySQL the projects are locked first ({@link LOCK_EMPLOYEE_PROJECTS}) and the locks last until the
 * transaction ends: the write's own when there is one, otherwise one opened for the recount. SQLite has a single
 * writer, so recounts never interleave there, and no `FOR UPDATE`.
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
	const lock =
		dbType === DatabaseTypeEnum.postgres || dbType === DatabaseTypeEnum.mysql
			? replacePlaceholders(p(LOCK_EMPLOYEE_PROJECTS), dbType)
			: null;

	const ormType = getORMType();
	if (ormType === MultiORMEnum.TypeORM && em instanceof TypeOrmEntityManager) {
		const recount = async (manager: TypeOrmEntityManager) => {
			if (lock) await manager.query(lock, [employeeId]);
			await manager.query(query, [employeeId]);
		};
		if (lock && !em.queryRunner?.isTransactionActive) {
			await em.transaction(recount);
		} else {
			await recount(em);
		}
	} else if (ormType === MultiORMEnum.MikroORM && em instanceof MikroOrmEntityManager) {
		// In the write's transaction, if there is one: on its own connection the recount would read the employee
		// row as it was before the write, or wait for the transaction that is waiting for this hook.
		const recount = async (manager: MikroOrmEntityManager) => {
			const connection = manager.getConnection();
			const context = manager.getTransactionContext();
			if (lock) await connection.execute(lock.replace(/\$\d/g, '?'), [employeeId], 'all', context);
			await connection.execute(query.replace(/\$\d/g, '?'), [employeeId], 'run', context);
		};
		if (lock && !em.getTransactionContext()) {
			await em.transactional(recount);
		} else {
			await recount(em);
		}
	}
}
