import { Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { DataSource, FindOptionsWhere, In, LessThan, MoreThan, Not } from 'typeorm';
import { ID, IEmbedClientReport, IEmbedClientReportProject, TimeLogType } from '@gauzy/contracts';
import { Organization, OrganizationContact, OrganizationProject, TimeLog } from '../core/entities/internal';
import {
	clientReportOf,
	clientReportPeriodsOf,
	IEmbedClientReportEntry,
	IEmbedClientReportSpan
} from './embed-client-report';

/** The tenant and organization a credential belongs to. */
export interface IEmbedClientScope {
	tenantId: ID;
	organizationId: ID;
}

/** A client as an embed answer names it: its id and its name, nothing else. */
export type EmbedClient = IEmbedClientReport['client'];

/** A project as a client report names it. */
type EmbedClientProject = Pick<IEmbedClientReportProject, 'id' | 'name'>;

/**
 * The client (an organization contact) an embed credential is limited to. Read through TypeORM whichever ORM the
 * server runs, so both answer the same; a contact deleted (for good or softly) is no client.
 */
@Injectable()
export class EmbedClientService {
	constructor(private readonly dataSource: DataSource) {}

	/**
	 * A contact of the tenant and organization that is not deleted.
	 *
	 * @param id The contact's id.
	 * @param scope The credential's tenant and organization.
	 * @returns The client, or null for any other contact.
	 */
	async findClient(id: ID, scope: IEmbedClientScope): Promise<EmbedClient | null> {
		// TypeORM drops a condition whose value is undefined: without these, the read would match any contact.
		const namesContact = isUUID(id);
		const isScoped = Boolean(scope.tenantId) && Boolean(scope.organizationId);
		if (!namesContact || !isScoped) {
			return null;
		}
		const contact = await this.dataSource.getRepository(OrganizationContact).findOne({
			where: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
			select: { id: true, name: true }
		});
		if (!contact) {
			return null;
		}
		return { id: contact.id, name: contact.name };
	}

	/**
	 * The client's spent time now: today, this week, and this week by project, in the organization's calendar. Only the
	 * time entries of the client's projects in the tenant and organization count, deleted ones and breaks left out.
	 *
	 * @param id The contact the credential is limited to.
	 * @param scope The credential's tenant and organization.
	 * @param now When the report is asked.
	 * @returns The report, or null when the client is gone (deleted, or no contact of the organization).
	 */
	async reportOf(id: ID, scope: IEmbedClientScope, now: Date): Promise<IEmbedClientReport | null> {
		const client = await this.findClient(id, scope);
		if (!client) {
			return null;
		}
		const organization = await this.dataSource.getRepository(Organization).findOne({
			where: { id: scope.organizationId, tenantId: scope.tenantId },
			select: { id: true, timeZone: true, startWeekOn: true }
		});
		if (!organization) {
			return null;
		}
		const periods = clientReportPeriodsOf(organization, now);
		const projects = await this.projectsOf(client, scope);
		const entries = await this.entriesOf(projects, scope, periods.week);
		return clientReportOf({ client, periods, projects, entries, now });
	}

	/** The client's projects in the tenant and organization, not deleted. */
	private async projectsOf(client: EmbedClient, scope: IEmbedClientScope): Promise<EmbedClientProject[]> {
		const projects = await this.dataSource.getRepository(OrganizationProject).find({
			where: { organizationContactId: client.id, tenantId: scope.tenantId, organizationId: scope.organizationId },
			select: { id: true, name: true }
		});
		return projects.map((project) => ({ id: project.id, name: project.name }));
	}

	/**
	 * The time entries of the projects that reach into the week: started before it ends, and stopped after it starts or
	 * still running (a running timer stores its start as its end). Deleted entries and breaks are left out.
	 */
	private async entriesOf(
		projects: EmbedClientProject[],
		scope: IEmbedClientScope,
		week: IEmbedClientReportSpan
	): Promise<IEmbedClientReportEntry[]> {
		if (projects.length === 0) {
			return [];
		}
		const ofProjects: FindOptionsWhere<TimeLog> = {
			tenantId: scope.tenantId,
			organizationId: scope.organizationId,
			projectId: In(projects.map((project) => project.id)),
			startedAt: LessThan(week.until.toDate()),
			logType: Not(TimeLogType.BREAK)
		};
		const logs = await this.dataSource.getRepository(TimeLog).find({
			where: [
				{ ...ofProjects, stoppedAt: MoreThan(week.from.toDate()) },
				{ ...ofProjects, isRunning: true }
			],
			select: { id: true, projectId: true, startedAt: true, stoppedAt: true, isRunning: true, source: true }
		});
		return logs.map((log) => ({
			projectId: log.projectId,
			startedAt: log.startedAt,
			stoppedAt: log.stoppedAt ?? null,
			isRunning: log.isRunning ?? null,
			source: log.source ?? null
		}));
	}
}
