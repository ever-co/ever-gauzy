import { Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { DataSource, FindOptionsWhere, In, LessThan, MoreThan, Not } from 'typeorm';
import {
	ID,
	IEmbedClientReport,
	IEmbedClientReportProject,
	IEmbedProject,
	TimeLogSourceEnum,
	TimeLogType
} from '@gauzy/contracts';
import { Organization, OrganizationContact, OrganizationProject, Task, TimeLog } from '../core/entities/internal';
import { TRACKER_SOURCES } from '../time-tracking/time-log/tracker-source';
import {
	clientReportOf,
	clientReportPeriodsOf,
	IEmbedClientReportEntry,
	IEmbedClientReportSpan
} from './embed-client-report';
import { IEmbedClientStart } from './embed-session';

/** The tenant and organization a credential belongs to. */
export interface IEmbedClientScope {
	tenantId: ID;
	organizationId: ID;
}

/** What an embed token lists the projects of: its tenant and organization, its member, and its client if it has one. */
export interface IEmbedProjectsScope extends IEmbedClientScope {
	employeeId: ID;
	clientId: ID | null;
}

/** A client as an embed answer names it: its id and its name, nothing else. */
export type EmbedClient = IEmbedClientReport['client'];

/** A project as a client report names it. */
type EmbedClientProject = Pick<IEmbedClientReportProject, 'id' | 'name'>;

/** By name, then by id: the same order whatever the database's collation. */
function byName(a: IEmbedProject, b: IEmbedProject): number {
	const byNames = a.name.localeCompare(b.name, 'en');
	if (byNames !== 0) {
		return byNames;
	}
	return a.id.localeCompare(b.id);
}

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

	/**
	 * Whether a timer start keeps to the client: its project is one of the client's, and its task, if it names one, a
	 * task of that project. Both in the tenant and organization, and not deleted.
	 *
	 * @param clientId The client the token's credential is limited to.
	 * @param scope The token's tenant and organization.
	 * @param start The project and the task the start names.
	 */
	async isStartForClient(clientId: ID, scope: IEmbedClientScope, start: IEmbedClientStart): Promise<boolean> {
		const isClientProject = await this.isProjectOfClient(start.projectId, clientId, scope);
		if (!isClientProject) {
			return false;
		}
		if (!start.taskId) {
			return true;
		}
		return await this.isTaskOfProject(start.taskId, start.projectId, scope);
	}

	/** Whether a project is one of the client's in the tenant and organization, not deleted. */
	private async isProjectOfClient(projectId: ID, clientId: ID, scope: IEmbedClientScope): Promise<boolean> {
		// TypeORM drops a condition whose value is undefined: without these, the read would match any project.
		const namesProject = isUUID(projectId);
		const namesClient = isUUID(clientId);
		const isScoped = Boolean(scope.tenantId) && Boolean(scope.organizationId);
		if (!namesProject || !namesClient || !isScoped) {
			return false;
		}
		return await this.dataSource.getRepository(OrganizationProject).exists({
			where: {
				id: projectId,
				organizationContactId: clientId,
				tenantId: scope.tenantId,
				organizationId: scope.organizationId
			}
		});
	}

	/** Whether a task is one of the project's in the tenant and organization, not deleted. */
	private async isTaskOfProject(taskId: ID, projectId: ID, scope: IEmbedClientScope): Promise<boolean> {
		if (!isUUID(taskId)) {
			return false;
		}
		return await this.dataSource.getRepository(Task).exists({
			where: { id: taskId, projectId, tenantId: scope.tenantId, organizationId: scope.organizationId }
		});
	}

	/**
	 * The projects an embed token may track time on, by name: its client's for a token limited to one, else the ones its
	 * member belongs to, as a member or a manager (the rule of `GET /organization-projects/employee/:id`). Only those of
	 * the tenant and organization, neither archived nor deleted, as the project pickers offer them. A private project is
	 * never hidden from its own members, so the private projects rule leaves none of the member's out.
	 *
	 * @param token The token's tenant and organization, member and client.
	 */
	async trackableProjectsOf(token: IEmbedProjectsScope): Promise<IEmbedProject[]> {
		const trackable = this.trackableCondition(token);
		const isScoped = Boolean(token.tenantId) && Boolean(token.organizationId);
		if (!trackable || !isScoped) {
			return [];
		}
		const projects = await this.dataSource.getRepository(OrganizationProject).find({
			where: { ...trackable, tenantId: token.tenantId, organizationId: token.organizationId, isArchived: false },
			select: { id: true, name: true }
		});
		const answer = projects.map((project) => ({ id: project.id, name: project.name }));
		return answer.sort(byName);
	}

	/**
	 * The condition that names the token's projects: its client's, else its member's; none for an id that is not one,
	 * which TypeORM would drop from the read.
	 */
	private trackableCondition(token: IEmbedProjectsScope): FindOptionsWhere<OrganizationProject> | null {
		if (token.clientId) {
			if (!isUUID(token.clientId)) {
				return null;
			}
			return { organizationContactId: token.clientId };
		}
		if (!isUUID(token.employeeId)) {
			return null;
		}
		return { members: { employeeId: token.employeeId } };
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
	 * a timer still running (a running timer stores its start as its end). Deleted entries and breaks are left out. A
	 * tracker's uploads stay stored as running and count up to their stored end (`countedEndOf`), so only the first
	 * condition reads them: the running ones of past weeks are not read on every report.
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
				{ ...ofProjects, isRunning: true, source: Not(In([...TRACKER_SOURCES] as TimeLogSourceEnum[])) }
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
