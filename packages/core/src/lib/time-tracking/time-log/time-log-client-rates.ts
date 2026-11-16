import { ForbiddenException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { ID, ITimeLog, ITimeLogClientRates, ITimeLogStoredRates } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { OrganizationProjectEmployee } from '../../core/entities/internal';
import {
	CURRENT_MEMBERSHIP,
	managesEveryProjectRate
} from '../../organization-project/organization-project-rate.service';
import { assertCurrentUserBelongsToOrganization } from '../../user-organization/assert-organization-membership';
import { findStoredRatesOf } from './time-log-rates';

/** The refusal of a read of client rates the caller may not read. */
export const CLIENT_RATES_REFUSED =
	'Only an admin, or a manager of every project asked (projectIds), reads the client rates of its time.';

/** The time a read of client rates is about. */
export interface ClientRatesScope {
	organizationId?: ID;
	projectIds?: ID[];
}

/** A project id as the database compares it: uuids match whatever their case. */
function idKeyOf(id: ID): string {
	return String(id).toLowerCase();
}

/**
 * Refuses a read of the client rates time logs keep to anyone who may not read the client rates of their projects
 * today (`GET /organization-projects/:id/rates`): an admin reads them all; a manager only those of the projects they
 * manage, so they must name them all in `projectIds`. A refusal is a 403, never a rate left out, so a client never
 * takes a refusal for a missing rate.
 *
 * @param manager The TypeORM entity manager, which runs under both ORMs.
 * @param scope The organization and the projects the read is about.
 * @throws ForbiddenException for a caller who may not read them all.
 */
export async function assertMayReadClientRates(manager: EntityManager, scope: ClientRatesScope): Promise<void> {
	await assertCurrentUserBelongsToOrganization(manager, scope.organizationId);
	if (managesEveryProjectRate()) {
		return;
	}

	const employeeId = RequestContext.currentEmployeeId();
	const projectKeys = [...new Set((scope.projectIds ?? []).map(idKeyOf))];
	const namesProjects = projectKeys.length > 0;
	if (!employeeId || !namesProjects) {
		throw new ForbiddenException(CLIENT_RATES_REFUSED);
	}

	const managed = await manager.find(OrganizationProjectEmployee, {
		where: {
			organizationProjectId: In(scope.projectIds),
			employeeId,
			organizationId: scope.organizationId,
			tenantId: RequestContext.currentTenantId(),
			isManager: true,
			...CURRENT_MEMBERSHIP
		},
		select: { id: true, organizationProjectId: true }
	});
	const managedKeys = new Set(managed.map(({ organizationProjectId }) => idKeyOf(organizationProjectId)));
	const managesEveryProjectAsked = projectKeys.every((key) => managedKeys.has(key));
	if (!managesEveryProjectAsked) {
		throw new ForbiddenException(CLIENT_RATES_REFUSED);
	}
}

/** The client rates of stored rates, null where the log kept none. */
function clientRatesOf(stored: ITimeLogStoredRates | undefined): ITimeLogClientRates {
	return {
		projectBillRateValue: stored?.projectBillRateValue ?? null,
		projectMemberBillRateValue: stored?.projectMemberBillRateValue ?? null,
		projectBillRateCurrency: stored?.projectBillRateCurrency ?? null,
		projectMemberBillRateCurrency: stored?.projectMemberBillRateCurrency ?? null
	};
}

/**
 * States on each log the client rates it keeps, read by name: they stay out of every generic read (`select: false`).
 * A log that keeps none states them all null, beside its `ratesStored`.
 *
 * @param manager The TypeORM entity manager, which runs under both ORMs.
 * @param logs The logs a read answers.
 * @param tenantId The tenant of the logs.
 * @returns The same logs, each with its `clientRates`.
 */
export async function withKeptClientRates<T extends Pick<ITimeLog, 'id'>>(
	manager: EntityManager,
	logs: T[],
	tenantId: ID
): Promise<Array<T & Pick<ITimeLog, 'clientRates'>>> {
	const logIds = logs.map(({ id }) => id).filter(Boolean);
	const stored = await findStoredRatesOf(manager, logIds, tenantId);
	for (const log of logs) {
		Object.assign(log, { clientRates: clientRatesOf(stored.get(log.id)) });
	}
	return logs;
}
