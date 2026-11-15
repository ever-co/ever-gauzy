import { Logger } from '@nestjs/common';
import { Brackets, DataSource } from 'typeorm';
import { ID, ITeamNotificationDefaults } from '@gauzy/contracts';
import { Employee, OrganizationTeam, OrganizationTeamEmployee, User } from '../core/entities/internal';
import { teamNotificationDefaultsOf } from './team-notification-defaults.rules';

export * from './team-notification-defaults.rules';

/**
 * The team whose defaults apply to each of the given employees, and those defaults: the team the employee's user last
 * worked in (`lastTeamId`, the one Ever Teams opens) when they are an active member of it, else their only team in
 * their organization. An employee in several teams who last worked in none of them, or whose team has no defaults,
 * gets none, so nothing changes for them. Best effort: defaults that cannot be read are none, so a reminder or a
 * delivery never waits on them.
 *
 * @param employees The employees, each with the tenant it is read in.
 * @returns The defaults by `tenantId:employeeId`, for the employees who have some.
 */
export async function teamNotificationDefaultsByEmployee(
	dataSource: DataSource,
	employees: ReadonlyArray<{ employeeId: ID; tenantId: ID }>
): Promise<Map<string, ITeamNotificationDefaults>> {
	const found = new Map<string, ITeamNotificationDefaults>();
	const ids = [...new Set(employees.map(({ employeeId }) => String(employeeId)))];
	if (!ids.length) return found;
	let rows: Array<{ employeeId: ID; tenantId: ID; teamId: ID; notificationDefaults: unknown; lastTeamId: ID | null }>;
	try {
		rows = await dataSource
			.getRepository(OrganizationTeamEmployee)
			.createQueryBuilder('membership')
			.innerJoin(
				Employee,
				'employee',
				'employee.id = membership.employeeId AND employee.tenantId = membership.tenantId'
			)
			.innerJoin(
				OrganizationTeam,
				'team',
				'team.id = membership.organizationTeamId AND team.tenantId = membership.tenantId AND team.organizationId = employee.organizationId'
			)
			.leftJoin(User, 'user', 'user.id = employee.userId')
			.select('membership.employeeId', 'employeeId')
			.addSelect('membership.tenantId', 'tenantId')
			.addSelect('team.id', 'teamId')
			.addSelect('team.notificationDefaults', 'notificationDefaults')
			.addSelect('user.lastTeamId', 'lastTeamId')
			.where('membership.employeeId IN (:...ids)', { ids })
			.andWhere(
				new Brackets((active) =>
					active
						.where('membership.isActive IS NULL')
						.orWhere('membership.isActive = :active', { active: true })
				)
			)
			.andWhere(
				new Brackets((archived) =>
					archived
						.where('team.isArchived IS NULL')
						.orWhere('team.isArchived = :notArchived', { notArchived: false })
				)
			)
			.getRawMany();
	} catch (error) {
		new Logger('TeamNotificationDefaults').warn(
			`The team notification defaults were not read: ${(error as Error)?.message ?? error}`
		);
		return found;
	}

	const wanted = new Set(employees.map(({ employeeId, tenantId }) => `${tenantId}:${employeeId}`));
	const teamsOf = new Map<string, typeof rows>();
	for (const row of rows) {
		const key = `${row.tenantId}:${row.employeeId}`;
		if (!wanted.has(key)) continue;
		teamsOf.set(key, [...(teamsOf.get(key) ?? []), row]);
	}
	for (const [key, teams] of teamsOf) {
		const current = teams.find((team) => team.lastTeamId && String(team.teamId) === String(team.lastTeamId));
		const team = current ?? (teams.length === 1 ? teams[0] : null);
		const defaults = team ? teamNotificationDefaultsOf(team.notificationDefaults) : null;
		if (defaults) found.set(key, defaults);
	}
	return found;
}
