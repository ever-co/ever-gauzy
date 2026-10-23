import { ID } from '@gauzy/contracts';
import { Repository } from 'typeorm';
import { assertGraphNotForeign } from '../../core/crud/nested-graph-ownership.helper';
import { TimeLog } from './time-log.entity';

/** The rows a time log names besides its owner: what the time was worked on, and for whom. */
export const TIME_LOG_REFERENCES = ['projectId', 'taskId', 'organizationContactId', 'organizationTeamId'] as const;

/**
 * Refuses a time log that names a project, task, client or team of another tenant.
 *
 * The timer (`POST /timesheet/timer/start`, `/toggle`) and the manual-time routes take these ids from the body, and
 * the time-log handlers write them through the repository, past the cross-tenant check the base service runs. A
 * caller could therefore file their own time against another tenant's task, project or client, and read that row
 * back through their own log (`GET /timesheet/timer/status?relations[]=task`, `relations[]=organizationContact`).
 * The ids are held to the caller's tenant as an owner-side relation of any entity is (`assertGraphNotForeign`): a
 * row of another tenant is refused, a row of no tenant may be linked, and an absent or null id is not checked.
 *
 * @param repository - The time-log repository, for the manager and the relation metadata.
 * @param values - The time log, or the change set, about to be written.
 * @param tenantId - The tenant the log belongs to.
 * @throws ForbiddenException when an id names a row of another tenant.
 */
export async function assertTimeLogReferencesOfTenant(
	repository: Repository<TimeLog>,
	values: Partial<Record<(typeof TIME_LOG_REFERENCES)[number], unknown>> | null | undefined,
	tenantId: ID
): Promise<void> {
	const references = Object.fromEntries(
		TIME_LOG_REFERENCES.filter((column) => values?.[column] !== undefined).map((column) => [column, values[column]])
	);
	await assertGraphNotForeign(repository.manager, repository.metadata, [references], tenantId);
}
