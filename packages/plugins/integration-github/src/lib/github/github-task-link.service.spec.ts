/**
 * The GitHub report of closed linked pull requests and issues (spec `task-automations`, T16) on a real database
 * (better-sqlite3): which organizations a delivery reaches (those that bound its installation), which of their tasks it
 * names (a link to the item, a reference in the pull request, the mirrored issue), the scope and payload of each
 * report, and what is never reported — an unlinked item, another organization's or tenant's task, a deleted one, a
 * redelivery.
 *
 * `@gauzy/core` is doubled at the module boundary (its barrel boots the whole application): the entities the service
 * reads are mapped below by fixture schemas, the settings lookup and the reference resolution are stand-ins.
 */
jest.mock('@gauzy/core', () => {
	class ResourceLink {}
	class IntegrationMap {}
	class Task {}
	class TaskService {}
	class TaskLinkClosedEvent {
		constructor(public readonly input: unknown) {}
	}
	class IntegrationSettingGetManyCommand {
		constructor(public readonly input: unknown) {}
	}
	return { ResourceLink, IntegrationMap, Task, TaskService, TaskLinkClosedEvent, IntegrationSettingGetManyCommand };
});

import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource, EntitySchema } from 'typeorm';
import { ITaskLinkClosedEvent, ITaskReferenceResolution, IntegrationEntity } from '@gauzy/contracts';
import { IntegrationMap, IntegrationSettingGetManyCommand, ResourceLink, Task, TaskLinkClosedEvent } from '@gauzy/core';
import {
	GithubTaskLinkService,
	IGithubIssueClosedPayload,
	IGithubPullRequestClosedPayload
} from './github-task-link.service';

jest.setTimeout(120_000);

const TENANT = randomUUID();
const OTHER_TENANT = randomUUID();
const ORG = randomUUID();
const SISTER_ORG = randomUUID(); // another organization of TENANT that bound the same installation
const FOREIGN_ORG = randomUUID(); // an organization of OTHER_TENANT that did not
const INTEGRATION = randomUUID();
const SISTER_INTEGRATION = randomUUID();
const INSTALLATION = 4242;

const base = {
	id: { type: String, primary: true, generated: 'uuid' as const },
	tenantId: { type: String, nullable: true },
	organizationId: { type: String, nullable: true },
	deletedAt: { type: Date, nullable: true, deleteDate: true },
	createdAt: { type: Date, createDate: true },
	updatedAt: { type: Date, updateDate: true }
};
const schema = (name: string, target: object, tableName: string, columns: Record<string, unknown>) =>
	new EntitySchema({
		name,
		target: target as never,
		tableName,
		columns: { ...base, ...(columns as object) } as never
	});
const linkSchema = schema('ResourceLink', ResourceLink, 'resource_link', {
	entity: { type: String },
	entityId: { type: String },
	title: { type: String },
	url: { type: 'text' }
});
const mapSchema = schema('IntegrationMap', IntegrationMap, 'integration_map', {
	entity: { type: String },
	sourceId: { type: String },
	gauzyId: { type: String },
	integrationId: { type: String }
});
const taskSchema = schema('Task', Task, 'task', { title: { type: String } });

describe('GithubTaskLinkService', () => {
	let directory: string;
	let dataSource: DataSource;
	let published: ITaskLinkClosedEvent[];
	let service: GithubTaskLinkService;
	let settings: Array<{ integration: { id: string; tenantId: string; organizationId: string } }>;
	let references: Record<string, { tenantId: string; organizationId: string; taskId: string }>;
	let resolveReferences: jest.Mock;
	let execute: jest.Mock;

	const createTask = async (tenantId = TENANT, organizationId = ORG): Promise<string> => {
		const id = randomUUID();
		await dataSource.getRepository(Task).save({ id, tenantId, organizationId, title: 'A task' } as never);
		return id;
	};
	const link = async (taskId: string, url: string, tenantId = TENANT, organizationId = ORG) => {
		const id = randomUUID();
		await dataSource
			.getRepository(ResourceLink)
			.save({ id, tenantId, organizationId, entity: 'Task', entityId: taskId, title: 'PR', url } as never);
		return id;
	};
	const mirror = (taskId: string, issueId: string, integrationId = INTEGRATION, organizationId = ORG) =>
		dataSource.getRepository(IntegrationMap).save({
			id: randomUUID(),
			tenantId: TENANT,
			organizationId,
			entity: IntegrationEntity.ISSUE,
			sourceId: issueId,
			gauzyId: taskId,
			integrationId
		} as never);

	const pullRequest = (
		overrides: Partial<NonNullable<IGithubPullRequestClosedPayload['pull_request']>> = {}
	): IGithubPullRequestClosedPayload => ({
		action: 'closed',
		installation: { id: INSTALLATION },
		repository: { full_name: 'Acme/Site' },
		pull_request: {
			id: 9001,
			number: 7,
			html_url: 'https://github.com/Acme/Site/pull/7',
			title: 'Fix the footer',
			state: 'closed',
			merged: true,
			head: { ref: 'fix-footer' },
			...overrides
		}
	});
	const issue = (
		overrides: Partial<NonNullable<IGithubIssueClosedPayload['issue']>> = {}
	): IGithubIssueClosedPayload => ({
		action: 'closed',
		installation: { id: INSTALLATION },
		repository: { full_name: 'acme/site' },
		issue: { id: 555, number: 6, html_url: 'https://github.com/acme/site/issues/6', state: 'closed', ...overrides }
	});

	beforeAll(() => {
		directory = mkdtempSync(join(tmpdir(), 'gauzy-github-task-link-'));
	});

	afterAll(() => {
		rmSync(directory, { recursive: true, force: true });
	});

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: join(directory, `${randomUUID()}.sqlite3`),
			entities: [linkSchema, mapSchema, taskSchema],
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();
		published = [];
		settings = [{ integration: { id: INTEGRATION, tenantId: TENANT, organizationId: ORG } }];
		references = {};
		execute = jest.fn(async (command: unknown) =>
			command instanceof IntegrationSettingGetManyCommand ? settings : []
		);
		resolveReferences = jest.fn(async (input: { tenantId: string; organizationId: string; references: string[] }) =>
			input.references.map((reference): ITaskReferenceResolution => {
				const found = references[reference];
				const resolved =
					!!found && found.tenantId === input.tenantId && found.organizationId === input.organizationId;
				return {
					reference,
					key: reference.split('-')[0],
					number: Number(reference.split('-')[1]),
					resolved,
					...(resolved ? { taskId: found.taskId } : {})
				};
			})
		);
		const eventBus = { publish: jest.fn((event: unknown) => published.push((event as TaskLinkClosedEvent).input)) };
		service = new GithubTaskLinkService({ execute } as never, eventBus as never, dataSource, {
			resolveReferences
		} as never);
	});

	afterEach(async () => {
		await dataSource.destroy();
	});

	describe('a closed pull request', () => {
		it('reports the task linked to it, once, in the organization that bound the installation', async () => {
			const task = await createTask();
			await link(task, 'https://github.com/acme/site/pull/7/files');
			expect(await service.pullRequestClosed('delivery-1', pullRequest())).toBe(1);
			expect(published).toEqual([
				{
					taskId: task,
					tenantId: TENANT,
					organizationId: ORG,
					provider: 'github',
					kind: 'pull_request',
					url: 'https://github.com/Acme/Site/pull/7',
					externalId: '9001',
					merged: true
				}
			]);
			const [command] = execute.mock.calls[0] as [IntegrationSettingGetManyCommand];
			expect((command as unknown as { input: { where: Record<string, unknown> } }).input.where).toMatchObject({
				settingsName: 'installation_id',
				settingsValue: String(INSTALLATION),
				isActive: true,
				isArchived: false
			});
		});

		it('reports a pull request an imported Linear, Asana or Trello attachment points at (kept as a link of the task)', async () => {
			const task = await createTask();
			// What the attachment imports write: a link of the task, with the attachment's address.
			await link(task, 'https://github.com/acme/site/pull/7#partial-pull-merging');
			expect(await service.pullRequestClosed('delivery-1', pullRequest())).toBe(1);
			expect(published).toEqual([expect.objectContaining({ taskId: task, kind: 'pull_request' })]);
		});

		it('reports a pull request closed without merging, saying so', async () => {
			const task = await createTask();
			await link(task, 'https://github.com/acme/site/pull/7');
			await service.pullRequestClosed('delivery-1', pullRequest({ merged: false }));
			expect(published).toEqual([expect.objectContaining({ taskId: task, merged: false })]);
		});

		it('reports the tasks its title and branch reference, resolved in the organization', async () => {
			const footer = await createTask();
			const header = await createTask();
			references['WEB-42'] = { tenantId: TENANT, organizationId: ORG, taskId: footer };
			references['WEB-43'] = { tenantId: TENANT, organizationId: ORG, taskId: header };
			// Both a link and a reference: still one report.
			await link(footer, 'https://github.com/acme/site/pull/7');
			await service.pullRequestClosed(
				'delivery-1',
				pullRequest({ title: 'WEB-42: fix the footer', head: { ref: 'feature/WEB-43-header' } })
			);
			expect(resolveReferences).toHaveBeenCalledWith({
				tenantId: TENANT,
				organizationId: ORG,
				references: ['WEB-42', 'WEB-43']
			});
			expect(published.map((event) => event.taskId).sort()).toEqual([footer, header].sort());
		});

		it('finds the linked task among many links to other items of the repository', async () => {
			const decoy = await createTask();
			// Links to items 70–79, 700–799 and 7000–7149, written before the one link to item 7.
			for (const number of [
				...Array.from({ length: 10 }, (_, index) => 70 + index),
				...Array.from({ length: 100 }, (_, index) => 700 + index),
				...Array.from({ length: 150 }, (_, index) => 7000 + index)
			]) {
				await link(decoy, `https://github.com/acme/site/pull/${number}`);
			}
			const task = await createTask();
			await link(task, 'https://github.com/acme/site/issues/7#issuecomment-1');
			expect(await service.pullRequestClosed('delivery-1', pullRequest())).toBe(1);
			expect(published).toEqual([expect.objectContaining({ taskId: task })]);
		});

		it('reports nothing for a pull request no task is linked to', async () => {
			const task = await createTask();
			await link(task, 'https://github.com/acme/site/pull/70');
			await link(task, 'https://github.com/acme/other/pull/7');
			await link(task, 'https://example.com/acme/site/pull/7');
			references['WEB-42'] = { tenantId: TENANT, organizationId: ORG, taskId: task };
			expect(
				await service.pullRequestClosed(
					'delivery-1',
					pullRequest({ title: 'web-42 lower case is no reference' })
				)
			).toBe(0);
			expect(published).toEqual([]);
		});

		it('never reports another organization’s or tenant’s task, or one deleted', async () => {
			const foreign = await createTask(OTHER_TENANT, FOREIGN_ORG);
			const sister = await createTask(TENANT, SISTER_ORG);
			const deleted = await createTask();
			// Links to the pull request held by organizations that did not bind the installation.
			await link(foreign, 'https://github.com/acme/site/pull/7', OTHER_TENANT, FOREIGN_ORG);
			await link(sister, 'https://github.com/acme/site/pull/7', TENANT, SISTER_ORG);
			// A link of this organization to a task of another one, and a link to a deleted task.
			await link(foreign, 'https://github.com/acme/site/pull/7');
			await link(deleted, 'https://github.com/acme/site/pull/7');
			await dataSource.getRepository(Task).softDelete({ id: deleted } as never);
			// A reference the organization does not resolve, and one that resolves elsewhere.
			references['WEB-1'] = { tenantId: OTHER_TENANT, organizationId: FOREIGN_ORG, taskId: foreign };
			expect(await service.pullRequestClosed('delivery-1', pullRequest({ title: 'WEB-1 WEB-2' }))).toBe(0);
			expect(published).toEqual([]);
		});

		it('reports for each organization that bound the installation, each in its own scope', async () => {
			settings.push({ integration: { id: SISTER_INTEGRATION, tenantId: TENANT, organizationId: SISTER_ORG } });
			const ours = await createTask();
			const sister = await createTask(TENANT, SISTER_ORG);
			await link(ours, 'https://github.com/acme/site/pull/7');
			await link(sister, 'https://github.com/acme/site/pull/7', TENANT, SISTER_ORG);
			expect(await service.pullRequestClosed('delivery-1', pullRequest())).toBe(2);
			expect(published.map(({ taskId, organizationId }) => ({ taskId, organizationId }))).toEqual(
				expect.arrayContaining([
					{ taskId: ours, organizationId: ORG },
					{ taskId: sister, organizationId: SISTER_ORG }
				])
			);
		});

		it('reports nothing for an installation no organization bound, or a delivery that is no close', async () => {
			const task = await createTask();
			await link(task, 'https://github.com/acme/site/pull/7');
			settings = [];
			expect(await service.pullRequestClosed('delivery-1', pullRequest())).toBe(0);
			settings = [{ integration: { id: INTEGRATION, tenantId: TENANT, organizationId: ORG } }];
			expect(await service.pullRequestClosed('delivery-2', { ...pullRequest(), action: 'reopened' })).toBe(0);
			expect(await service.pullRequestClosed('delivery-3', { ...pullRequest(), installation: null })).toBe(0);
			expect(await service.pullRequestClosed('delivery-4', { ...pullRequest(), repository: null })).toBe(0);
			expect(published).toEqual([]);
		});

		it('reports a redelivery under the same identity, which the automations keep once', async () => {
			const task = await createTask();
			await link(task, 'https://github.com/acme/site/pull/7');
			expect(await service.pullRequestClosed('delivery-1', pullRequest())).toBe(1);
			expect(await service.pullRequestClosed('delivery-1', pullRequest())).toBe(1);
			// Same task, provider, kind and GitHub id: the claim of the first report keeps the second out of the outbox.
			expect(published[1]).toEqual(published[0]);
		});
	});

	describe('a delivery that fails', () => {
		it('tries every organization, then throws, so the receiver logs it and a redelivery reports again', async () => {
			settings.push({ integration: { id: SISTER_INTEGRATION, tenantId: TENANT, organizationId: SISTER_ORG } });
			const ours = await createTask();
			const sister = await createTask(TENANT, SISTER_ORG);
			await link(ours, 'https://github.com/acme/site/pull/7');
			await link(sister, 'https://github.com/acme/site/pull/7', TENANT, SISTER_ORG);
			resolveReferences.mockRejectedValueOnce(new Error('database down'));
			await expect(service.pullRequestClosed('delivery-1', pullRequest({ title: 'WEB-9' }))).rejects.toThrow(
				/Not every task linked to the closed GitHub pull_request acme\/site#7 \(delivery delivery-1\) was reported \(1 were\): integration .*database down/
			);
			// The organization that could be read was reported.
			expect(published.map((event) => event.taskId)).toEqual([sister]);
			expect(await service.pullRequestClosed('delivery-1', pullRequest({ title: 'WEB-9' }))).toBe(2);
		});

		it('throws when the organizations of the installation cannot be read', async () => {
			execute.mockRejectedValueOnce(new Error('database down'));
			await expect(service.pullRequestClosed('delivery-1', pullRequest())).rejects.toThrow('database down');
			expect(published).toEqual([]);
		});
	});

	describe('a closed issue', () => {
		it('reports the task that mirrors it through this integration, and a task linked to it', async () => {
			const mirrored = await createTask();
			const linked = await createTask();
			await mirror(mirrored, '555');
			await link(linked, 'https://github.com/acme/site/issues/6');
			expect(await service.issueClosed('delivery-1', issue())).toBe(2);
			expect(published).toEqual(
				expect.arrayContaining([
					{
						taskId: mirrored,
						tenantId: TENANT,
						organizationId: ORG,
						provider: 'github',
						kind: 'issue',
						url: 'https://github.com/acme/site/issues/6',
						externalId: '555'
					},
					{
						taskId: linked,
						tenantId: TENANT,
						organizationId: ORG,
						provider: 'github',
						kind: 'issue',
						url: 'https://github.com/acme/site/issues/6',
						externalId: '555'
					}
				])
			);
		});

		it('reports nothing for an issue mirrored through another integration or organization, or no issue', async () => {
			const task = await createTask();
			await mirror(task, '555', SISTER_INTEGRATION, SISTER_ORG);
			await mirror(task, '556');
			expect(await service.issueClosed('delivery-1', issue())).toBe(0);
			expect(await service.issueClosed('delivery-2', issue({ pull_request: { url: 'x' } }))).toBe(0);
			expect(published).toEqual([]);
		});
	});
});
