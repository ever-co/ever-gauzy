import { Injectable, Logger } from '@nestjs/common';
import { CommandBus, EventBus } from '@nestjs/cqrs';
import { Brackets, DataSource, In } from 'typeorm';
import { BaseEntityEnum, GithubPropertyMapEnum, ID, IIntegrationSetting, IntegrationEntity } from '@gauzy/contracts';
import {
	IntegrationMap,
	IntegrationSettingGetManyCommand,
	ResourceLink,
	Task,
	TaskLinkClosedEvent,
	TaskService
} from '@gauzy/core';
import {
	GITHUB_ITEM_URL_LIKE_ESCAPE,
	GithubItemKind,
	githubItemUrlPatterns,
	IGithubItemAddress,
	parseGithubItemUrl,
	repositoryAddressOf,
	sameGithubItem,
	taskReferencesOfPullRequest
} from './github-task-link';

/** The provider `task_link.closed` names for GitHub. */
export const GITHUB_TASK_LINK_PROVIDER = 'github';

/** The links of one organization to an item are read this many at a time (the patterns find that item's links only). */
const LINKS_PAGE = 200;

interface IGithubWebhookRepository {
	full_name?: string | null;
	name?: string | null;
	owner?: { login?: string | null } | null;
}

/** What `pull_request.closed` carries that the report reads. */
export interface IGithubPullRequestClosedPayload {
	action?: string;
	installation?: { id?: number | string | null } | null;
	repository?: IGithubWebhookRepository | null;
	pull_request?: {
		id?: number | string | null;
		number?: number | null;
		html_url?: string | null;
		title?: string | null;
		state?: string | null;
		merged?: boolean | null;
		head?: { ref?: string | null } | null;
	} | null;
}

/** What `issues.closed` carries that the report reads. */
export interface IGithubIssueClosedPayload {
	action?: string;
	installation?: { id?: number | string | null } | null;
	repository?: IGithubWebhookRepository | null;
	issue?: {
		id?: number | string | null;
		number?: number | null;
		html_url?: string | null;
		state?: string | null;
		/** Present when the "issue" is a pull request (GitHub sends those as `pull_request` events, not here). */
		pull_request?: unknown;
	} | null;
}

/** An organization that bound the installation: where its links are looked for, and the scope a report carries. */
interface IGithubTaskLinkScope {
	tenantId: ID;
	organizationId: ID;
	integrationId: ID;
}

/** The closed item, as the report names it. */
interface IGithubClosedItem {
	kind: GithubItemKind;
	address: IGithubItemAddress;
	externalId: string;
	url: string | null;
	merged?: boolean;
}

/**
 * Reports the closed pull requests and issues of GitHub that are linked to tasks (spec `task-automations`, T16) as the
 * platform's `TaskLinkClosedEvent`, which the task automations turn into `task_link.closed` for the "when a linked pull
 * request or issue closes" rules.
 *
 * The delivery is GitHub's (`pull_request.closed`, `issues.closed`; the signature is verified before it gets here) and
 * names an installation: only the organizations that bound that installation are searched, each in its own tenant and
 * organization, and a report carries that scope. Nothing crosses tenants: a link, a reference or a mirrored issue of
 * another organization is never read for it, and a task is reported only once it is read back in the scope.
 *
 * A pull request is linked to a task by a link of the task to its address, or by the task's reference in its title
 * or branch name; it is reported closed whether it was merged or not (`merged` says which). An issue is linked to the
 * task that mirrors it (the issue sync) and to a task with a link to its address.
 *
 * Once: a redelivery, a copy handled at the same time on another instance, or the same item closed again after a reopen
 * reports the same tasks under the same identity (provider, kind, the item's GitHub id), and the automations append
 * `task_link.closed` once per task and link — the claim and the event commit together, so a delivery whose report did not
 * reach the outbox is reported again by GitHub's redelivery. A delivery that failed for an organization is thrown back
 * once every organization was tried, so the receiver logs it.
 */
@Injectable()
export class GithubTaskLinkService {
	private readonly logger = new Logger(GithubTaskLinkService.name);

	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _eventBus: EventBus,
		private readonly _dataSource: DataSource,
		private readonly _taskService: TaskService
	) {}

	/** `pull_request.closed`: reports each task the pull request is linked to; answers how many reports were made. */
	async pullRequestClosed(
		deliveryId: string | null | undefined,
		payload: IGithubPullRequestClosedPayload
	): Promise<number> {
		const pullRequest = payload?.pull_request;
		const repository = repositoryAddressOf(payload?.repository);
		if (payload?.action !== 'closed' || !pullRequest?.id || !pullRequest.number || !repository) return 0;
		const item: IGithubClosedItem = {
			kind: 'pull_request',
			address: { ...repository, number: Number(pullRequest.number) },
			externalId: String(pullRequest.id),
			url: pullRequest.html_url ?? null,
			merged: pullRequest.merged === true
		};
		const references = taskReferencesOfPullRequest(pullRequest);
		return this.report(deliveryId, payload.installation?.id, item, async (scope) => [
			...(await this.tasksLinkingTo(scope, item.address)),
			...(await this.tasksReferencedBy(scope, references))
		]);
	}

	/** `issues.closed`: reports the task that mirrors the issue and each task with a link to it. */
	async issueClosed(deliveryId: string | null | undefined, payload: IGithubIssueClosedPayload): Promise<number> {
		const issue = payload?.issue;
		const repository = repositoryAddressOf(payload?.repository);
		if (payload?.action !== 'closed' || !issue?.id || !issue.number || issue.pull_request || !repository) return 0;
		const item: IGithubClosedItem = {
			kind: 'issue',
			address: { ...repository, number: Number(issue.number) },
			externalId: String(issue.id),
			url: issue.html_url ?? null
		};
		return this.report(deliveryId, payload.installation?.id, item, async (scope) => [
			...(await this.tasksMirroring(scope, item.externalId)),
			...(await this.tasksLinkingTo(scope, item.address))
		]);
	}

	/**
	 * For each organization that bound the installation: its tasks linked to the item, read back in its scope, each
	 * reported once. Every organization is tried; when one failed, the delivery is thrown back afterwards.
	 */
	private async report(
		deliveryId: string | null | undefined,
		installationId: number | string | null | undefined,
		item: IGithubClosedItem,
		linked: (scope: IGithubTaskLinkScope) => Promise<ID[]>
	): Promise<number> {
		const about = `the closed GitHub ${item.kind} ${item.address.owner}/${item.address.repo}#${item.address.number} (delivery ${deliveryId ?? 'without id'})`;
		let reported = 0;
		const failures: string[] = [];
		for (const scope of await this.scopesOf(installationId)) {
			try {
				const taskIds = await this.tasksOf(scope, [...new Set(await linked(scope))]);
				for (const taskId of taskIds) {
					this._eventBus.publish(
						new TaskLinkClosedEvent({
							taskId,
							tenantId: scope.tenantId,
							organizationId: scope.organizationId,
							provider: GITHUB_TASK_LINK_PROVIDER,
							kind: item.kind,
							url: item.url,
							externalId: item.externalId,
							...(item.kind === 'pull_request' ? { merged: item.merged === true } : {})
						})
					);
					reported += 1;
				}
			} catch (error) {
				failures.push(`integration ${scope.integrationId}: ${(error as Error)?.message}`);
			}
		}
		if (failures.length) {
			throw new Error(
				`Not every task linked to ${about} was reported (${reported} were): ${failures.join('; ')}`
			);
		}
		return reported;
	}

	/**
	 * The organizations that bound the installation (an active setting `installation_id` of an active integration),
	 * each once. Read across tenants, as every GitHub webhook is: the installation id is what names the organization.
	 */
	private async scopesOf(installationId: number | string | null | undefined): Promise<IGithubTaskLinkScope[]> {
		if (installationId === null || installationId === undefined || String(installationId).trim() === '') return [];
		const settings: IIntegrationSetting[] = await this._commandBus.execute(
			new IntegrationSettingGetManyCommand({
				where: {
					settingsName: GithubPropertyMapEnum.INSTALLATION_ID,
					settingsValue: String(installationId),
					isActive: true,
					isArchived: false,
					integration: { isActive: true, isArchived: false }
				},
				relations: { integration: true }
			})
		);
		const scopes = new Map<ID, IGithubTaskLinkScope>();
		for (const setting of settings ?? []) {
			const integration = setting?.integration;
			if (!integration?.id || !integration.tenantId || !integration.organizationId) continue;
			scopes.set(integration.id, {
				tenantId: integration.tenantId,
				organizationId: integration.organizationId,
				integrationId: integration.id
			});
		}
		return [...scopes.values()];
	}

	/** The tasks of the scope with a link to the item (pull request or issue: one numbering), every page of them. */
	private async tasksLinkingTo(scope: IGithubTaskLinkScope, address: IGithubItemAddress): Promise<ID[]> {
		const taskIds: ID[] = [];
		for (let offset = 0; ; offset += LINKS_PAGE) {
			const rows = await this._dataSource
				.getRepository(ResourceLink)
				.createQueryBuilder('link')
				.select(['link.id', 'link.entityId', 'link.url'])
				.where('link.tenantId = :tenantId', { tenantId: scope.tenantId })
				.andWhere('link.organizationId = :organizationId', { organizationId: scope.organizationId })
				.andWhere('link.entity = :entity', { entity: BaseEntityEnum.Task })
				.andWhere(
					new Brackets((patterns) => {
						githubItemUrlPatterns(address).forEach((pattern, index) =>
							patterns.orWhere(
								`LOWER(link.url) LIKE :pattern${index} ESCAPE '${GITHUB_ITEM_URL_LIKE_ESCAPE}'`,
								{
									[`pattern${index}`]: pattern
								}
							)
						);
					})
				)
				.orderBy('link.id', 'ASC')
				.skip(offset)
				.take(LINKS_PAGE)
				.getMany();
			for (const row of rows) {
				if (sameGithubItem(parseGithubItemUrl(row.url), address)) taskIds.push(row.entityId);
			}
			if (rows.length < LINKS_PAGE) return taskIds;
		}
	}

	/** The tasks of the scope its references in a pull request's title and branch name resolve to. */
	private async tasksReferencedBy(scope: IGithubTaskLinkScope, references: string[]): Promise<ID[]> {
		if (!references.length) return [];
		const resolutions = await this._taskService.resolveReferences({
			tenantId: scope.tenantId,
			organizationId: scope.organizationId,
			references
		});
		return resolutions
			.filter((resolution) => resolution.resolved && resolution.taskId)
			.map((resolution) => resolution.taskId as ID);
	}

	/** The task of the scope that mirrors the issue (through this integration's map). */
	private async tasksMirroring(scope: IGithubTaskLinkScope, issueId: string): Promise<ID[]> {
		const maps = await this._dataSource.getRepository(IntegrationMap).find({
			where: {
				tenantId: scope.tenantId,
				organizationId: scope.organizationId,
				integrationId: scope.integrationId,
				entity: IntegrationEntity.ISSUE,
				sourceId: issueId
			} as never,
			select: { id: true, gauzyId: true } as never
		});
		return maps.map((map) => map.gauzyId as ID).filter(Boolean);
	}

	/** The given tasks that exist in the scope (not deleted), in the order given. */
	private async tasksOf(scope: IGithubTaskLinkScope, taskIds: ID[]): Promise<ID[]> {
		if (!taskIds.length) return [];
		const rows = await this._dataSource.getRepository(Task).find({
			where: { id: In(taskIds), tenantId: scope.tenantId, organizationId: scope.organizationId } as never,
			select: { id: true } as never
		});
		const found = new Set(rows.map((row) => row.id as ID));
		return taskIds.filter((taskId) => found.has(taskId));
	}
}
