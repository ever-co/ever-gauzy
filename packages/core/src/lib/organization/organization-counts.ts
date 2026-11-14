import { EntityManager, IsNull } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { getTotalDurationQueryString } from '../time-tracking/statistic/statistic.helper';
import { IOrganizationOfTenant } from './organization-deletion';

/**
 * What an organization holds, for the confirmation an admin reads before deleting it (ever-co/ever-gauzy#11960).
 * Soft-deleted rows are not counted.
 */
export interface IOrganizationCounts {
	/** Its teams. */
	teams: number;
	/** Its projects. */
	projects: number;
	/** Its members: member records that are not archived (an inactive member still counts). */
	members: number;
	/** The time tracked in it, in seconds, over every time log (a running one up to now). */
	trackedSeconds: number;
	/** Its invoices, estimates left out. */
	invoices: number;
	/** Its estimates. */
	estimates: number;
}

/**
 * Counts what an organization holds.
 *
 * Tables are named by their table name, as in `organization-deletion.ts`: the data source resolves the entity, and
 * its reads leave soft-deleted rows out.
 *
 * @param manager An entity manager.
 * @param organization The organization, already read in the caller's tenant.
 * @returns The counts.
 */
export async function countOrganizationContents(
	manager: EntityManager,
	organization: IOrganizationOfTenant
): Promise<IOrganizationCounts> {
	const { id, tenantId } = organization;
	const ofOrganization = { tenantId, organizationId: id };

	const teams = await countRows(manager, 'organization_team', ofOrganization);
	const projects = await countRows(manager, 'organization_project', ofOrganization);
	const members = await countRows(manager, 'employee', { ...ofOrganization, isArchived: false });
	const invoices = await countRows(manager, 'invoice', [
		{ ...ofOrganization, isEstimate: false },
		{ ...ofOrganization, isEstimate: IsNull() }
	]);
	const estimates = await countRows(manager, 'invoice', { ...ofOrganization, isEstimate: true });
	const trackedSeconds = await sumTrackedSeconds(manager, id, tenantId);

	return { teams, projects, members, trackedSeconds, invoices, estimates };
}

/**
 * Counts the rows of a table that match a criteria, soft-deleted rows left out.
 *
 * @param manager An entity manager.
 * @param table The table.
 * @param where The rows; a list is read as "any of".
 * @returns The count.
 */
async function countRows(
	manager: EntityManager,
	table: string,
	where: Record<string, unknown> | Record<string, unknown>[]
): Promise<number> {
	return await manager.createQueryBuilder(table, table).where(where).getCount();
}

/**
 * The seconds tracked in an organization: the length of every time log not deleted, a running one up to now (the
 * expression the overall statistic uses).
 *
 * @param manager An entity manager.
 * @param organizationId The organization.
 * @param tenantId Its workspace.
 * @returns Whole seconds.
 */
async function sumTrackedSeconds(manager: EntityManager, organizationId: ID, tenantId: ID): Promise<number> {
	const dbType = manager.connection.options.type;
	const row: { trackedSeconds: number | string | null } | undefined = await manager
		.createQueryBuilder('time_log', 'time_log')
		.select(getTotalDurationQueryString(dbType, 'time_log'), 'trackedSeconds')
		.where({ tenantId, organizationId })
		.getRawOne();
	return Math.round(Number(row?.trackedSeconds ?? 0));
}
