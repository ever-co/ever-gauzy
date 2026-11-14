/**
 * Task automations on a real database (better-sqlite3, the demo's engine): the migrations (up, up again, down) and the
 * role grants; the rules (create blank or from a template, edit, reorder, delete, the organization checks); the run
 * store (once per change, the lease, the rate-limit count, the pruned history); the task reader; and the engine end to
 * end — a sub-task closed closes its parent, a duplicate delivery runs nothing, the loop guard holds, the dry run writes
 * nothing, the due-date sweep reports a due date once, a closed linked pull request moves its task through the capture,
 * the outbox and the consumer once — with a writer that applies the update to the task row.
 *
 * `@gauzy/core` is doubled at the module boundary (its barrel boots the whole application), as the other plugin
 * database suites do: the entities are mapped below by fixture schemas over the tables the migrations create, and over
 * the platform tables the services read.
 */
const mockCaller: { tenantId: string | null; userId: string | null; organizationId: string | null } = {
	tenantId: null,
	userId: null,
	organizationId: null
};
/** The ORM `DB_ORM` names, as `getORMType` answers it. */
const mockOrm = { current: 'typeorm' };

jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	class BaseEntity {}
	class Task {}
	class TaskStatus {}
	class TaskPriority {}
	class Employee {}
	class Tag {}
	class OrganizationProject {}
	class OrganizationTeam {}
	class UserOrganization {}
	class TaskUpdateCommand {
		constructor(
			public readonly id: string,
			public readonly input: Record<string, unknown>
		) {}
	}
	class EmployeeCreateNotificationEvent {}
	class TaskLinkClosedEvent {
		constructor(public readonly input: unknown) {}
	}
	return {
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		TenantOrganizationBaseEntity: BaseEntity,
		MikroOrmBaseEntityRepository: class {},
		Task,
		TaskStatus,
		TaskPriority,
		Employee,
		Tag,
		OrganizationProject,
		OrganizationTeam,
		UserOrganization,
		TaskUpdateCommand,
		EmployeeCreateNotificationEvent,
		TaskLinkClosedEvent,
		EventOutboxService: class EventOutboxService {},
		EventConsumerRegistry: class EventConsumerRegistry {
			static consumerKeyOf(consumer: { kind?: string; key: string }) {
				return `${consumer.kind}:${consumer.key}`;
			}
		},
		MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
		getORMType: () => mockOrm.current,
		RequestContext: {
			currentTenantId: () => mockCaller.tenantId,
			currentUserId: () => mockCaller.userId,
			currentOrganizationId: () => mockCaller.organizationId,
			currentUser: () => null,
			setClsService: () => undefined,
			// The writer's system actor: the work runs with the actor's tenant, then the caller's comes back.
			runWithRequest: (request: { user?: { tenantId?: string } }, fn: () => unknown) => {
				const previous = mockCaller.tenantId;
				mockCaller.tenantId = request.user?.tenantId ?? null;
				const restore = () => {
					mockCaller.tenantId = previous;
				};
				try {
					const result = fn();
					if (result instanceof Promise) return result.finally(restore);
					restore();
					return result;
				} catch (error) {
					restore();
					throw error;
				}
			}
		}
	};
});

import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { knex } from 'knex';
import { DataSource, EntitySchema } from 'typeorm';
import {
	IOutboxWriteInput,
	ITaskAutomationChangeEvent,
	ITaskLinkClosedEvent,
	PermissionsEnum,
	RolesEnum,
	TaskAutomationActionEnum,
	TaskAutomationConditionEnum,
	TaskAutomationRunOutcomeEnum,
	TaskAutomationStatusCategoryEnum,
	TaskAutomationTriggerEnum
} from '@gauzy/contracts';
import { Employee, OrganizationProject, OrganizationTeam, Tag, Task, TaskLinkClosedEvent, TaskPriority, TaskStatus, UserOrganization } from '@gauzy/core';
import { TASK_AUTOMATION_MIGRATIONS } from './database/task-automation-migrations';
import { TaskAutomationLinkClosure } from './entities/task-automation-link-closure.entity';
import { TaskAutomationRule } from './entities/task-automation-rule.entity';
import { TaskAutomationRun } from './entities/task-automation-run.entity';
import { ITaskAutomationTaskUpdate } from './engine/actions';
import { ITaskAutomationActorMarker } from './engine/loop-guard';
import { ITaskAutomationTaskSnapshot } from './engine/task-snapshot';
import { TaskAutomationEventConsumer } from './events/task-automation-event.consumer';
import { TaskAutomationLinkClosedCapture } from './events/task-automation-link-closed.capture';
import { dueEventKey, TaskAutomationDueSweepService } from './schedule/task-automation-due-sweep.service';
import { TaskAutomationEngine } from './services/task-automation-engine.service';
import { TaskAutomationLinkClosureStore } from './services/task-automation-link-closure.store';
import { ITaskAutomationScope, TaskAutomationRuleService } from './services/task-automation-rule.service';
import { TaskAutomationRunStore } from './services/task-automation-run.store';
import { TaskAutomationRunner } from './services/task-automation-runner.service';
import { TaskAutomationRetryLaterError, TaskAutomationTaskLock } from './services/task-automation-task-lock';
import { TaskAutomationTaskReader } from './services/task-automation-task-reader.service';
import { TaskAutomationWriter } from './services/task-automation-writer.service';

jest.setTimeout(120_000);

const TENANT = randomUUID();
const OTHER_TENANT = randomUUID();
const ORG = randomUUID();
const OTHER_ORG = randomUUID();
const MANAGER = randomUUID();
const PROJECT = randomUUID();
const OTHER_PROJECT = randomUUID(); // a project of the other organization
const TEAM = randomUUID();
const ADA = randomUUID(); // employees of ORG
const BOB = randomUUID();
const STRANGER = randomUUID(); // an employee of OTHER_ORG
const ADA_USER = randomUUID();
const TAG_REVIEW = randomUUID();

const base = {
	id: { type: String, primary: true, generated: 'uuid' as const },
	tenantId: { type: String, nullable: true },
	organizationId: { type: String, nullable: true },
	isActive: { type: Boolean, nullable: true, default: true },
	isArchived: { type: Boolean, nullable: true, default: false },
	archivedAt: { type: Date, nullable: true },
	deletedAt: { type: Date, nullable: true, deleteDate: true },
	createdAt: { type: Date, createDate: true },
	updatedAt: { type: Date, updateDate: true },
	createdByUserId: { type: String, nullable: true },
	updatedByUserId: { type: String, nullable: true }
};

const ruleSchema = new EntitySchema({
	name: 'TaskAutomationRule',
	target: TaskAutomationRule,
	tableName: 'task_automation_rule',
	columns: {
		...base,
		name: { type: String },
		description: { type: String, nullable: true },
		projectId: { type: String, nullable: true },
		organizationTeamId: { type: String, nullable: true },
		isEnabled: { type: Boolean, default: false },
		position: { type: Number, default: 0 },
		templateKey: { type: String, nullable: true },
		triggerType: { type: String },
		triggerConfig: { type: String, nullable: true },
		conditions: { type: String, nullable: true },
		actions: { type: String, nullable: true },
		lastRunAt: { type: Date, nullable: true }
	}
});

const runSchema = new EntitySchema({
	name: 'TaskAutomationRun',
	target: TaskAutomationRun,
	tableName: 'task_automation_run',
	columns: {
		...base,
		ruleId: { type: String },
		taskId: { type: String, nullable: true },
		eventKey: { type: String },
		triggerType: { type: String },
		outcome: { type: String },
		depth: { type: Number, default: 0 },
		details: { type: String, nullable: true },
		error: { type: String, nullable: true },
		durationMs: { type: Number, nullable: true }
	}
});

const closureSchema = new EntitySchema({
	name: 'TaskAutomationLinkClosure',
	target: TaskAutomationLinkClosure,
	tableName: 'task_automation_link_closure',
	columns: {
		...base,
		taskId: { type: String },
		provider: { type: String },
		kind: { type: String },
		externalId: { type: String }
	}
});

const simple = (name: string, target: object, tableName: string, columns: Record<string, unknown>) =>
	new EntitySchema({ name, target: target as never, tableName, columns: { ...base, ...(columns as object) } as never });

const statusSchema = simple('TaskStatus', TaskStatus, 'task_status', {
	name: { type: String, nullable: true },
	value: { type: String, nullable: true },
	projectId: { type: String, nullable: true },
	order: { type: Number, nullable: true },
	isTodo: { type: Boolean, nullable: true },
	isInProgress: { type: Boolean, nullable: true },
	isDone: { type: Boolean, nullable: true }
});
const prioritySchema = simple('TaskPriority', TaskPriority, 'task_priority', {
	name: { type: String, nullable: true },
	value: { type: String, nullable: true },
	projectId: { type: String, nullable: true }
});
const employeeSchema = simple('Employee', Employee, 'employee', { userId: { type: String, nullable: true } });
const tagSchema = simple('Tag', Tag, 'tag', { name: { type: String, nullable: true } });
const projectSchema = simple('OrganizationProject', OrganizationProject, 'organization_project', { name: { type: String, nullable: true } });
const teamSchema = simple('OrganizationTeam', OrganizationTeam, 'organization_team', { name: { type: String, nullable: true } });
const userOrganizationSchema = simple('UserOrganization', UserOrganization, 'user_organization', { userId: { type: String } });
const taskSchema = new EntitySchema({
	name: 'Task',
	target: Task as never,
	tableName: 'task',
	columns: {
		...base,
		title: { type: String },
		status: { type: String, nullable: true },
		taskStatusId: { type: String, nullable: true },
		priority: { type: String, nullable: true },
		taskPriorityId: { type: String, nullable: true },
		projectId: { type: String, nullable: true },
		parentId: { type: String, nullable: true },
		dueDate: { type: Date, nullable: true },
		number: { type: Number, nullable: true },
		prefix: { type: String, nullable: true }
	} as never,
	relations: {
		members: { type: 'many-to-many', target: 'Employee', joinTable: { name: 'task_employee', joinColumn: { name: 'taskId' }, inverseJoinColumn: { name: 'employeeId' } } },
		tags: { type: 'many-to-many', target: 'Tag', joinTable: { name: 'tag_task', joinColumn: { name: 'taskId' }, inverseJoinColumn: { name: 'tagId' } } },
		teams: { type: 'many-to-many', target: 'OrganizationTeam', joinTable: { name: 'task_team', joinColumn: { name: 'taskId' }, inverseJoinColumn: { name: 'organizationTeamId' } } }
	} as never
});

/** The platform tables the migrations reference or seed, and the rows the cases use. */
async function createCoreFixture(dataSource: DataSource): Promise<void> {
	await dataSource.query(`CREATE TABLE "tenant" ("id" varchar PRIMARY KEY NOT NULL)`);
	await dataSource.query(`CREATE TABLE "organization" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar)`);
	await dataSource.query(
		`CREATE TABLE "role" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "name" varchar, "deletedAt" datetime)`
	);
	await dataSource.query(
		`CREATE TABLE "role_permission" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "roleId" varchar, "permission" varchar, "enabled" boolean, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedAt" datetime)`
	);
	await dataSource.query(`INSERT INTO "tenant" ("id") VALUES (?), (?)`, [TENANT, OTHER_TENANT]);
	await dataSource.query(`INSERT INTO "organization" ("id", "tenantId") VALUES (?, ?), (?, ?)`, [ORG, TENANT, OTHER_ORG, TENANT]);
	for (const [name, tenantId] of [
		[RolesEnum.SUPER_ADMIN, TENANT],
		[RolesEnum.ADMIN, TENANT],
		[RolesEnum.MANAGER, TENANT],
		[RolesEnum.EMPLOYEE, TENANT],
		[RolesEnum.ADMIN, OTHER_TENANT]
	]) {
		await dataSource.query(`INSERT INTO "role" ("id", "tenantId", "name") VALUES (?, ?, ?)`, [randomUUID(), tenantId, name]);
	}
}

async function seedPlatform(dataSource: DataSource): Promise<void> {
	await dataSource.synchronize(false);
	const save = (target: object, rows: Array<Record<string, unknown>>) => dataSource.getRepository(target as never).save(rows as never);
	await save(UserOrganization, [{ id: randomUUID(), tenantId: TENANT, organizationId: ORG, userId: MANAGER, isActive: true }]);
	await save(OrganizationProject, [
		{ id: PROJECT, tenantId: TENANT, organizationId: ORG, name: 'Website' },
		{ id: OTHER_PROJECT, tenantId: TENANT, organizationId: OTHER_ORG, name: 'Elsewhere' }
	]);
	await save(OrganizationTeam, [{ id: TEAM, tenantId: TENANT, organizationId: ORG, name: 'Core' }]);
	await save(Employee, [
		{ id: ADA, tenantId: TENANT, organizationId: ORG, userId: ADA_USER },
		{ id: BOB, tenantId: TENANT, organizationId: ORG, userId: null },
		{ id: STRANGER, tenantId: TENANT, organizationId: OTHER_ORG, userId: randomUUID() }
	]);
	await save(Tag, [{ id: TAG_REVIEW, tenantId: TENANT, organizationId: ORG, name: 'Review' }]);
	await save(TaskStatus, [
		{ id: 'st-open', tenantId: TENANT, organizationId: ORG, value: 'open', name: 'Open', order: 1, isTodo: true },
		{ id: 'st-progress', tenantId: TENANT, organizationId: ORG, value: 'in-progress', name: 'In Progress', order: 2, isInProgress: true },
		{ id: 'st-done', tenantId: TENANT, organizationId: ORG, value: 'done', name: 'Done', order: 3, isDone: true }
	]);
	await save(TaskPriority, [{ id: 'pr-high', tenantId: TENANT, organizationId: ORG, value: 'high', name: 'High' }]);
}

/** A writer that applies the update to the task row (the platform's command is out of reach here), and records notices. */
class RowWriter {
	readonly updates: Array<{ taskId: string; update: ITaskAutomationTaskUpdate; marker: ITaskAutomationActorMarker }> = [];
	readonly notices: Array<{ taskId: string; employeeIds: string[]; eventKey: string }> = [];
	inboxLoaded = true;

	constructor(private readonly dataSource: DataSource) {}

	async applyUpdate(task: ITaskAutomationTaskSnapshot, update: ITaskAutomationTaskUpdate, marker: ITaskAutomationActorMarker) {
		this.updates.push({ taskId: task.id, update, marker });
		const repository = this.dataSource.getRepository(Task as never);
		const row = (await repository.findOne({ where: { id: task.id } as never, relations: { members: true, tags: true } as never })) as Record<string, unknown>;
		if ('status' in update) Object.assign(row, { status: update.status, taskStatusId: update.taskStatusId });
		if ('priority' in update) Object.assign(row, { priority: update.priority, taskPriorityId: update.taskPriorityId });
		if (update.memberIds) row['members'] = update.memberIds.map((id) => ({ id }));
		if (update.tagIds) row['tags'] = update.tagIds.map((id) => ({ id }));
		await repository.save(row as never);
		return { written: true, lists: null, unchanged: [] as Array<'members' | 'tags'> };
	}

	currentLists(task: ITaskAutomationTaskSnapshot) {
		return new TaskAutomationTaskReader(this.dataSource).lists(task.tenantId, task.id);
	}

	async notify(task: ITaskAutomationTaskSnapshot, notice: { employeeIds: string[] }, _marker: unknown, eventKey: string) {
		this.notices.push({ taskId: task.id, employeeIds: notice.employeeIds, eventKey });
		return { channel: 'inbox' as const, recipients: notice.employeeIds.length };
	}

	describe(error: unknown): string {
		return error instanceof Error ? error.message : String(error);
	}
}

describe('Task automations on SQLite', () => {
	let directory: string;
	let dataSource: DataSource;
	let rules: TaskAutomationRuleService;
	let runs: TaskAutomationRunStore;
	let reader: TaskAutomationTaskReader;
	let writer: RowWriter;
	let runner: TaskAutomationRunner;
	let engine: TaskAutomationEngine;
	let scope: ITaskAutomationScope;

	const asManager = (organizationId: string | null = ORG) => {
		mockCaller.tenantId = TENANT;
		mockCaller.userId = MANAGER;
		mockCaller.organizationId = organizationId;
	};

	const createTask = async (overrides: Record<string, unknown> = {}): Promise<string> => {
		const id = randomUUID();
		await dataSource.getRepository(Task as never).save({
			id,
			tenantId: TENANT,
			organizationId: ORG,
			title: 'A task',
			status: 'open',
			taskStatusId: 'st-open',
			...overrides
		} as never);
		return id;
	};

	const outcomeOf = async (ruleId: string, eventKey: string) =>
		(await dataSource.getRepository(TaskAutomationRun).findOne({ where: { ruleId, eventKey } as never }))?.outcome;

	const taskRow = (id: string) =>
		dataSource.getRepository(Task as never).findOne({ where: { id } as never, relations: { members: true, tags: true } as never }) as Promise<
			Record<string, any>
		>;

	const statusChange = (taskId: string, from: string, to: string, overrides: Partial<ITaskAutomationChangeEvent> = {}): ITaskAutomationChangeEvent => ({
		taskId,
		tenantId: TENANT,
		organizationId: ORG,
		action: 'updated',
		changes: { status: { from, to }, taskStatusId: { from: `st-${from === 'in-progress' ? 'progress' : from}`, to: `st-${to === 'in-progress' ? 'progress' : to}` } },
		depth: 0,
		chain: [],
		...overrides
	});

	beforeAll(() => {
		directory = mkdtempSync(join(tmpdir(), 'gauzy-task-automations-'));
	});

	afterAll(() => {
		rmSync(directory, { recursive: true, force: true });
	});

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: join(directory, `${randomUUID()}.sqlite3`),
			entities: [ruleSchema, runSchema, closureSchema],
			migrations: TASK_AUTOMATION_MIGRATIONS,
			synchronize: false,
			logging: false
		});
		await dataSource.initialize();
		await createCoreFixture(dataSource);
		await dataSource.runMigrations({ transaction: 'each' });
		// The platform tables the services read, created from their fixture schemas on a second data source over the
		// same file (the first one's metadata stays the plugin's own tables).
		const platform = new DataSource({
			type: 'better-sqlite3',
			database: dataSource.options.database as string,
			entities: [statusSchema, prioritySchema, employeeSchema, tagSchema, projectSchema, teamSchema, userOrganizationSchema, taskSchema],
			synchronize: false,
			logging: false
		});
		await platform.initialize();
		await seedPlatform(platform);
		await platform.destroy();
		await dataSource.destroy();
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: platform.options.database as string,
			entities: [
				ruleSchema,
				runSchema,
				closureSchema,
				statusSchema,
				prioritySchema,
				employeeSchema,
				tagSchema,
				projectSchema,
				teamSchema,
				userOrganizationSchema,
				taskSchema
			],
			migrations: TASK_AUTOMATION_MIGRATIONS,
			synchronize: false,
			logging: false
		});
		await dataSource.initialize();

		rules = new TaskAutomationRuleService(dataSource);
		runs = new TaskAutomationRunStore(dataSource);
		reader = new TaskAutomationTaskReader(dataSource);
		writer = new RowWriter(dataSource);
		runner = new TaskAutomationRunner(rules, runs, reader, writer as unknown as TaskAutomationWriter, new TaskAutomationTaskLock(dataSource));
		engine = new TaskAutomationEngine(rules, runner, reader, writer as unknown as TaskAutomationWriter);
		asManager();
		scope = await rules.callerScope();
	});

	afterEach(async () => {
		await dataSource.destroy();
	});

	describe('migrations', () => {
		const tables = async () =>
			(await dataSource.query(`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'task_automation_%' ORDER BY name`)).map(
				(row: { name: string }) => row.name
			);

		it('create the three tables, and a second run adds nothing', async () => {
			const all = ['task_automation_link_closure', 'task_automation_rule', 'task_automation_run'];
			expect(await tables()).toEqual(all);
			for (const Migration of TASK_AUTOMATION_MIGRATIONS) {
				await new Migration().up(dataSource.createQueryRunner());
			}
			expect(await tables()).toEqual(all);
		});

		it('keep one closed link per task and link', async () => {
			const insert = (taskId: string, externalId: string) =>
				dataSource.query(
					`INSERT INTO "task_automation_link_closure" ("id", "tenantId", "organizationId", "taskId", "provider", "kind", "externalId") VALUES (?, ?, ?, ?, 'github', 'pull_request', ?)`,
					[randomUUID(), TENANT, ORG, taskId, externalId]
				);
			const task = randomUUID();
			await insert(task, '1');
			await expect(insert(task, '1')).rejects.toThrow(/UNIQUE/);
			// Another item of the task, and the same item of another task, are other links.
			await insert(task, '2');
			await insert(randomUUID(), '1');
		});

		it('grant TASK_AUTOMATION_MANAGE to super admins, admins and managers, once', async () => {
			const grants = async () =>
				dataSource.query(
					`SELECT r."name" AS role, rp."enabled" AS enabled FROM "role_permission" rp JOIN "role" r ON r."id" = rp."roleId" WHERE rp."permission" = ? ORDER BY r."tenantId", r."name"`,
					[PermissionsEnum.TASK_AUTOMATION_MANAGE]
				);
			const first = await grants();
			expect(first.map((row: { role: string }) => row.role).sort()).toEqual(
				[RolesEnum.ADMIN, RolesEnum.ADMIN, RolesEnum.MANAGER, RolesEnum.SUPER_ADMIN].sort()
			);
			await new TASK_AUTOMATION_MIGRATIONS[1]().up(dataSource.createQueryRunner());
			expect(await grants()).toHaveLength(first.length);
		});

		it('keep one run per rule and change, and cascade with the rule; down drops the tables', async () => {
			const rule = await rules.create(scope, { templateKey: 'close-parent-when-subtasks-done' });
			const insert = () =>
				dataSource.query(
					`INSERT INTO "task_automation_run" ("id", "tenantId", "ruleId", "eventKey", "triggerType", "outcome") VALUES (?, ?, ?, 'e:1', 'X', 'APPLIED')`,
					[randomUUID(), TENANT, rule.id as string]
				);
			await insert();
			await expect(insert()).rejects.toThrow(/UNIQUE/);
			await dataSource.query('PRAGMA foreign_keys = ON');
			await dataSource.query(`DELETE FROM "task_automation_rule" WHERE "id" = ?`, [rule.id as string]);
			expect(await dataSource.query(`SELECT 1 FROM "task_automation_run"`)).toHaveLength(0);
			for (let index = TASK_AUTOMATION_MIGRATIONS.length - 1; index >= 0; index--) {
				await new TASK_AUTOMATION_MIGRATIONS[index]().down(dataSource.createQueryRunner());
			}
			expect(await tables()).toEqual([]);
		});
	});

	describe('rules', () => {
		it('scope the caller to the organization the request works in, or one they are a member of', async () => {
			await expect(rules.callerScope(OTHER_ORG)).rejects.toBeInstanceOf(ForbiddenException);
			asManager(null);
			expect((await rules.callerScope(ORG)).organizationId).toBe(ORG);
			await expect(rules.callerScope(OTHER_ORG)).rejects.toBeInstanceOf(ForbiddenException);
			await expect(rules.callerScope()).rejects.toBeInstanceOf(BadRequestException);
		});

		it('create from a template (on, its key kept) and blank, at the end of the order, with the creator', async () => {
			const first = await rules.create(scope, { templateKey: 'close-parent-when-subtasks-done' });
			expect(first).toMatchObject({
				name: 'Close the parent when all sub-tasks are done',
				isEnabled: true,
				position: 0,
				templateKey: 'close-parent-when-subtasks-done',
				trigger: { type: TaskAutomationTriggerEnum.ALL_SUBTASKS_DONE },
				actions: [{ type: TaskAutomationActionEnum.SET_STATUS, category: TaskAutomationStatusCategoryEnum.DONE }]
			});
			// A template that needs the organization's values starts switched off.
			expect((await rules.create(scope, { templateKey: 'status-sets-fields' })).isEnabled).toBe(false);
			const blank = await rules.create(scope, {
				name: 'Review gets a label',
				trigger: { type: TaskAutomationTriggerEnum.STATUS_CHANGED, toStatuses: ['st-progress'] },
				actions: [{ type: TaskAutomationActionEnum.ADD_LABELS, tagIds: [TAG_REVIEW] }],
				projectId: PROJECT
			});
			expect(blank).toMatchObject({ position: 2, projectId: PROJECT, templateKey: null, isEnabled: true });
			expect((await rules.list(scope)).map((rule) => rule.position)).toEqual([0, 1, 2]);
			expect((await rules.list(scope, { projectId: PROJECT })).map((rule) => rule.id)).toEqual([blank.id]);
			await expect(rules.create(scope, { templateKey: 'nope' })).rejects.toBeInstanceOf(BadRequestException);
		});

		it('refuse what is not the organization’s: a project, a person, a label, a status', async () => {
			const base = { name: 'x', trigger: { type: TaskAutomationTriggerEnum.TASK_ASSIGNED } };
			await expect(rules.create(scope, { ...base, actions: [{ type: TaskAutomationActionEnum.NOTIFY_ASSIGNEES }], projectId: OTHER_PROJECT })).rejects.toThrow(/project/);
			await expect(rules.create(scope, { ...base, actions: [{ type: TaskAutomationActionEnum.ADD_ASSIGNEES, employeeIds: [STRANGER] }] })).rejects.toThrow(/employee/);
			await expect(rules.create(scope, { ...base, actions: [{ type: TaskAutomationActionEnum.ADD_LABELS, tagIds: [randomUUID()] }] })).rejects.toThrow(/label/);
			await expect(rules.create(scope, { ...base, actions: [{ type: TaskAutomationActionEnum.SET_STATUS, status: 'shipped' }] })).rejects.toThrow(/status/);
			// A default value is every organization's.
			await expect(rules.create(scope, { ...base, actions: [{ type: TaskAutomationActionEnum.SET_STATUS, status: 'blocked' }] })).resolves.toBeDefined();
			await expect(rules.create(scope, { ...base, actions: [] })).rejects.toThrow(/at least one action/);
		});

		it('edit only what the body states, reorder, and delete with the runs; another organization’s is not found', async () => {
			const a = await rules.create(scope, { templateKey: 'close-parent-when-subtasks-done' });
			const b = await rules.create(scope, { templateKey: 'assigned-moves-in-progress' });
			const edited = await rules.update(scope, a.id as string, { name: 'Close parents', isEnabled: false });
			expect(edited).toMatchObject({ name: 'Close parents', isEnabled: false, trigger: a.trigger, actions: a.actions });
			expect((await rules.reorder(scope, [b.id as string])).map((rule) => rule.id)).toEqual([b.id, a.id]);
			await expect(rules.reorder(scope, [randomUUID()])).rejects.toBeInstanceOf(NotFoundException);
			const other = { ...scope, organizationId: OTHER_ORG };
			await expect(rules.get(other, a.id as string)).rejects.toBeInstanceOf(NotFoundException);
			await expect(rules.update(other, a.id as string, { name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
			await expect(rules.remove(scope, a.id as string)).resolves.toEqual({ id: a.id, deleted: true });
			expect((await rules.list(scope)).map((rule) => rule.id)).toEqual([b.id]);
		});

		it('keep “merged only” on a link trigger, store nothing for a rule without it, and refuse a value that is not true or false', async () => {
			const configOf = async (id: string) =>
				(await dataSource.query(`SELECT "triggerConfig" FROM "task_automation_rule" WHERE "id" = ?`, [id]))[0]
					.triggerConfig;
			const plain = await rules.create(scope, { templateKey: 'link-closed-sets-status' });
			expect(plain.trigger).toEqual({ type: TaskAutomationTriggerEnum.LINK_CLOSED, mergedOnly: false });
			// Stored as a rule saved before the option existed.
			expect(await configOf(plain.id as string)).toBeNull();

			const merged = await rules.update(scope, plain.id as string, {
				trigger: { type: TaskAutomationTriggerEnum.LINK_CLOSED, mergedOnly: true }
			});
			expect(merged.trigger).toEqual({ type: TaskAutomationTriggerEnum.LINK_CLOSED, mergedOnly: true });
			expect(JSON.parse(await configOf(plain.id as string))).toEqual({ mergedOnly: true });
			expect((await rules.get(scope, plain.id as string)).trigger).toEqual({
				type: TaskAutomationTriggerEnum.LINK_CLOSED,
				mergedOnly: true
			});
			// An edit that leaves the trigger out keeps it.
			expect(
				(await rules.update(scope, plain.id as string, { name: 'Merged moves to done' })).trigger.mergedOnly
			).toBe(true);

			await expect(
				rules.update(scope, plain.id as string, {
					trigger: { type: TaskAutomationTriggerEnum.LINK_CLOSED, mergedOnly: 'yes' } as never
				})
			).rejects.toThrow(/merged only/);
			await expect(
				rules.update(scope, plain.id as string, {
					trigger: { type: TaskAutomationTriggerEnum.LINK_CLOSED, mergedOnly: 'yes' } as never
				})
			).rejects.toBeInstanceOf(BadRequestException);
			const off = await rules.update(scope, plain.id as string, {
				trigger: { type: TaskAutomationTriggerEnum.LINK_CLOSED, mergedOnly: false }
			});
			expect(off.trigger).toEqual({ type: TaskAutomationTriggerEnum.LINK_CLOSED, mergedOnly: false });
			expect(await configOf(plain.id as string)).toBeNull();

			// Another trigger keeps no such setting.
			const assigned = await rules.create(scope, {
				name: 'Assigned',
				trigger: { type: TaskAutomationTriggerEnum.TASK_ASSIGNED, mergedOnly: true },
				actions: [{ type: TaskAutomationActionEnum.NOTIFY_ASSIGNEES }]
			});
			expect(assigned.trigger).toEqual({ type: TaskAutomationTriggerEnum.TASK_ASSIGNED });
		});

		it('tell the capture which triggers are on, and forget it when a rule changes', async () => {
			expect([...(await rules.enabledTriggers(TENANT, ORG))]).toEqual([]);
			const rule = await rules.create(scope, { templateKey: 'assigned-moves-in-progress' });
			expect([...(await rules.enabledTriggers(TENANT, ORG))]).toEqual([TaskAutomationTriggerEnum.TASK_ASSIGNED]);
			await rules.update(scope, rule.id as string, { isEnabled: false });
			expect([...(await rules.enabledTriggers(TENANT, ORG))]).toEqual([]);
		});
	});

	describe('run store', () => {
		let ruleId: string;
		beforeEach(async () => {
			ruleId = (await rules.create(scope, { templateKey: 'close-parent-when-subtasks-done' })).id as string;
		});
		const claim = (eventKey = 'event-1:task-1') => ({
			tenantId: TENANT,
			organizationId: ORG,
			ruleId,
			taskId: 'task-1',
			eventKey,
			triggerType: TaskAutomationTriggerEnum.STATUS_CHANGED,
			depth: 0
		});

		it('claims a run once per change, puts back one still running, and takes over one left running past its lease', async () => {
			const run = await runs.claim(claim());
			expect(run?.outcome).toBe(TaskAutomationRunOutcomeEnum.RUNNING);
			// Still running inside its lease: not "done", so the delivery is tried again later.
			await expect(runs.claim(claim())).rejects.toBeInstanceOf(TaskAutomationRetryLaterError);
			const later = new Date(Date.now() + 10 * 60_000);
			const taken = await runs.claim(claim(), later);
			expect(taken?.id).toBe(run?.id);
			await runs.finish(taken!, TaskAutomationRunOutcomeEnum.APPLIED, { details: { note: 'x' } });
			expect(await runs.claim(claim(), new Date(Date.now() + 60 * 60_000))).toBeNull();
			const [history] = await runs.history(ruleId);
			expect(history).toMatchObject({ outcome: TaskAutomationRunOutcomeEnum.APPLIED, details: { note: 'x' } });
		});

		it('counts the changes of a task for the rate limit, and keeps the newest runs only', async () => {
			for (let index = 0; index < 6; index++) {
				const run = await runs.claim(claim(`event-${index}:task-1`));
				await runs.finish(run!, index % 2 ? TaskAutomationRunOutcomeEnum.APPLIED : TaskAutomationRunOutcomeEnum.NO_CHANGE);
			}
			expect(await runs.changesSince('task-1', new Date(Date.now() - 60_000))).toBe(3);
			expect([...(await runs.finishedKeys(ruleId, ['event-5:task-1', 'nope']))]).toEqual(['event-5:task-1']);
			// Every run is younger than a day: its key still guards against a second run, so none goes.
			expect(await runs.prune(ruleId, 4)).toBe(0);
			expect(await runs.history(ruleId)).toHaveLength(6);
			// A day later only the newest four are kept.
			expect(await runs.prune(ruleId, 4, new Date(Date.now() + 26 * 60 * 60_000))).toBe(2);
			expect(await runs.history(ruleId)).toHaveLength(4);
		});
	});

	describe('engine', () => {
		it('closes the parent when its last sub-task is done, once, as the rule', async () => {
			const rule = await rules.create(scope, { templateKey: 'close-parent-when-subtasks-done' });
			const parent = await createTask({ title: 'Parent' });
			const first = await createTask({ parentId: parent, status: 'done', taskStatusId: 'st-done' });
			const last = await createTask({ parentId: parent, status: 'in-progress', taskStatusId: 'st-progress' });

			// Not every sub-task is done yet: nothing runs, nothing is recorded.
			expect(await engine.processChange('event-0', statusChange(first, 'open', 'done'))).toBe(0);

			await dataSource.getRepository(Task as never).update({ id: last } as never, { status: 'done', taskStatusId: 'st-done' } as never);
			expect(await engine.processChange('event-1', statusChange(last, 'in-progress', 'done'))).toBe(1);
			expect((await taskRow(parent))['status']).toBe('done');
			expect(writer.updates[0].marker).toMatchObject({ ruleId: rule.id, depth: 1, chain: [rule.id] });
			const [run] = await runs.history(rule.id as string);
			expect(run).toMatchObject({ outcome: TaskAutomationRunOutcomeEnum.APPLIED, taskId: parent, eventKey: `event-1:${parent}` });

			// The same change delivered again runs nothing.
			expect(await engine.processChange('event-1', statusChange(last, 'in-progress', 'done'))).toBe(0);
			expect(writer.updates).toHaveLength(1);
		});

		it('keeps to the rule’s scope and skips a rule that is off', async () => {
			const scoped = await rules.create(scope, {
				name: 'Website tasks in progress',
				trigger: { type: TaskAutomationTriggerEnum.TASK_ASSIGNED },
				actions: [{ type: TaskAutomationActionEnum.SET_STATUS, category: TaskAutomationStatusCategoryEnum.IN_PROGRESS }],
				projectId: PROJECT
			});
			const off = await rules.create(scope, { templateKey: 'assigned-moves-in-progress', isEnabled: false });
			const outside = await createTask();
			const inside = await createTask({ projectId: PROJECT });
			const assigned = (taskId: string) => ({ ...statusChange(taskId, 'open', 'open'), changes: { membersAdded: [ADA] } });
			expect(await engine.processChange('e-out', assigned(outside))).toBe(0);
			expect(await engine.processChange('e-in', assigned(inside))).toBe(1);
			expect((await taskRow(inside))['status']).toBe('in-progress');
			expect(await runs.history(off.id as string)).toEqual([]);
			expect((await runs.history(scoped.id as string))[0].outcome).toBe(TaskAutomationRunOutcomeEnum.APPLIED);
		});

		it('records conditions not met, no change, and the loop guard', async () => {
			const rule = await rules.create(scope, { templateKey: 'assigned-moves-in-progress' });
			const doing = await createTask({ status: 'in-progress', taskStatusId: 'st-progress' });
			await engine.processChange('e-1', { ...statusChange(doing, 'open', 'open'), changes: { membersAdded: [ADA] } });
			expect(await outcomeOf(rule.id as string, `e-1:${doing}`)).toBe(TaskAutomationRunOutcomeEnum.CONDITIONS_NOT_MET);

			const todo = await createTask();
			await engine.processChange('e-2', { ...statusChange(todo, 'open', 'open'), changes: { membersAdded: [ADA] }, depth: 2, chain: ['someone'] });
			expect(await outcomeOf(rule.id as string, `e-2:${todo}`)).toBe(TaskAutomationRunOutcomeEnum.LOOP_GUARD);
			expect((await taskRow(todo))['status']).toBe('open');

			await engine.processChange('e-3', { ...statusChange(todo, 'open', 'open'), changes: { membersAdded: [ADA] }, depth: 1, chain: [rule.id as string] });
			expect(await outcomeOf(rule.id as string, `e-3:${todo}`)).toBe(TaskAutomationRunOutcomeEnum.LOOP_GUARD);

			const label = await rules.create(scope, {
				name: 'Label in progress',
				trigger: { type: TaskAutomationTriggerEnum.STATUS_CHANGED },
				conditions: [{ type: TaskAutomationConditionEnum.IS_OPEN }],
				actions: [{ type: TaskAutomationActionEnum.ADD_LABELS, tagIds: [TAG_REVIEW] }]
			});
			const labelled = await createTask();
			await dataSource.query(`INSERT INTO "tag_task" ("taskId", "tagId") VALUES (?, ?)`, [labelled, TAG_REVIEW]);
			await engine.processChange('e-4', statusChange(labelled, 'open', 'in-progress'));
			expect(await outcomeOf(label.id as string, `e-4:${labelled}`)).toBe(TaskAutomationRunOutcomeEnum.NO_CHANGE);
		});

		it('answers a dry run and writes nothing', async () => {
			const rule = await rules.create(scope, { templateKey: 'close-parent-when-subtasks-done' });
			const parent = await createTask({ title: 'Parent' });
			await createTask({ parentId: parent, status: 'done', taskStatusId: 'st-done' });
			const result = await engine.dryRun(rule, parent);
			expect(result).toMatchObject({
				triggerMatches: true,
				subjectTaskId: parent,
				outcome: TaskAutomationRunOutcomeEnum.APPLIED,
				changes: [{ action: TaskAutomationActionEnum.SET_STATUS, field: 'status', from: 'open', to: 'done' }]
			});
			expect((await taskRow(parent))['status']).toBe('open');
			expect(await runs.history(rule.id as string)).toEqual([]);
			expect(writer.updates).toEqual([]);
			await expect(engine.dryRun(rule, randomUUID())).rejects.toBeInstanceOf(NotFoundException);
		});
	});

	describe('a closed link, from the integration’s report to the task (spec T16)', () => {
		const pullRequest: Omit<ITaskLinkClosedEvent, 'taskId' | 'tenantId' | 'organizationId'> = {
			provider: 'github',
			kind: 'pull_request',
			url: 'https://github.com/acme/site/pull/7',
			externalId: '9001',
			merged: true
		};

		/**
		 * The capture over the real closure table, an outbox that keeps what is appended, and the consumer over the real
		 * engine: `dispatch` hands each appended event to the consumer as the dispatch pass does, once.
		 */
		const pipeline = () => {
			const appended: Array<{ eventId: string; input: IOutboxWriteInput }> = [];
			const outbox = {
				append: jest.fn(async (_manager: unknown, input: IOutboxWriteInput) => {
					const eventId = randomUUID();
					appended.push({ eventId, input });
					return { eventId };
				})
			};
			const capture = new TaskAutomationLinkClosedCapture(rules, reader, new TaskAutomationLinkClosureStore(dataSource), outbox as never, dataSource);
			const consumer = new TaskAutomationEventConsumer({ register: jest.fn(), list: () => [] } as never, engine);
			const envelopeOf = ({ eventId, input }: { eventId: string; input: IOutboxWriteInput }) =>
				({ id: eventId, name: input.name, tenantId: input.tenantId, organizationId: input.organizationId, data: input.data }) as never;
			const dispatch = async () => {
				const events = appended.splice(0);
				for (const event of events) await consumer.handle(envelopeOf(event));
				return events;
			};
			return { capture, consumer, outbox, dispatch, envelopeOf };
		};

		const report = (taskId: string, overrides: Partial<ITaskLinkClosedEvent> = {}) =>
			new TaskLinkClosedEvent({ taskId, tenantId: TENANT, organizationId: ORG, ...pullRequest, ...overrides } as ITaskLinkClosedEvent);

		it('moves the task to done through the link-closed template, once however often the close is reported', async () => {
			const rule = await rules.create(scope, { templateKey: 'link-closed-sets-status' });
			const task = await createTask({ title: 'Footer' });
			const other = await createTask({ title: 'Header' });
			const { capture, consumer, outbox, dispatch, envelopeOf } = pipeline();

			await capture.handle(report(task) as never);
			expect(outbox.append).toHaveBeenCalledTimes(1);
			expect(outbox.append.mock.calls[0][1]).toMatchObject({
				name: 'task_link.closed',
				aggregateId: task,
				partitionKey: `task-automation:${task}`,
				tenantId: TENANT,
				organizationId: ORG,
				data: { taskId: task, provider: 'github', kind: 'pull_request', externalId: '9001', merged: true }
			});
			const [event] = await dispatch();

			expect((await taskRow(task))['status']).toBe('done');
			expect((await taskRow(other))['status']).toBe('open');
			const [run] = await runs.history(rule.id as string);
			expect(run).toMatchObject({
				outcome: TaskAutomationRunOutcomeEnum.APPLIED,
				taskId: task,
				triggerType: TaskAutomationTriggerEnum.LINK_CLOSED,
				eventKey: `${event.eventId}:${task}`
			});
			expect(writer.updates).toHaveLength(1);
			expect(writer.updates[0].marker).toMatchObject({ ruleId: rule.id, depth: 1, chain: [rule.id] });

			// The same close reported again — GitHub's redelivery, another instance, the pull request reopened and closed
			// again — appends nothing; the event handed to the consumer again runs nothing.
			await capture.handle(report(task) as never);
			await capture.handle(report(task, { merged: false, url: 'https://github.com/Acme/Site/pull/7/files' }) as never);
			expect(outbox.append).toHaveBeenCalledTimes(1);
			await consumer.handle(envelopeOf(event));
			expect(writer.updates).toHaveLength(1);
			expect(await runs.history(rule.id as string)).toHaveLength(1);
		});

		it('reports each linked task, and another link of the task, on its own', async () => {
			const rule = await rules.create(scope, { templateKey: 'link-closed-sets-status' });
			const first = await createTask();
			const second = await createTask();
			const { capture, outbox, dispatch } = pipeline();
			await capture.handle(report(first) as never);
			await capture.handle(report(second) as never);
			await dispatch();
			expect((await taskRow(first))['status']).toBe('done');
			expect((await taskRow(second))['status']).toBe('done');

			// The issue the pull request closed is another link of the task: reported, and the rule finds the task done.
			await capture.handle(report(first, { kind: 'issue', externalId: '77', url: 'https://github.com/acme/site/issues/6', merged: undefined }) as never);
			expect(outbox.append).toHaveBeenCalledTimes(3);
			await dispatch();
			const outcomes = (await runs.history(rule.id as string)).map((run) => run.outcome).sort();
			expect(outcomes).toEqual(
				[TaskAutomationRunOutcomeEnum.APPLIED, TaskAutomationRunOutcomeEnum.APPLIED, TaskAutomationRunOutcomeEnum.CONDITIONS_NOT_MET].sort()
			);
		});

		it('with “merged only”, a pull request closed without merging moves nothing; its merge after a reopen does, once (spec FR-21)', async () => {
			const rule = await rules.create(scope, {
				templateKey: 'link-closed-sets-status',
				trigger: { type: TaskAutomationTriggerEnum.LINK_CLOSED, mergedOnly: true }
			});
			const task = await createTask();
			const { capture, outbox, dispatch } = pipeline();

			// Closed without merging: the rule waits for a merge.
			await capture.handle(report(task, { merged: false }) as never);
			await dispatch();
			expect((await taskRow(task))['status']).toBe('open');
			expect(writer.updates).toEqual([]);
			expect(await runs.history(rule.id as string)).toEqual([]);

			// Reopened, then merged: the close without merging did not use up the report the merge needs.
			await capture.handle(report(task, { merged: true }) as never);
			expect(outbox.append).toHaveBeenCalledTimes(2);
			expect(outbox.append.mock.calls[1][1].data).toMatchObject({
				kind: 'pull_request',
				merged: true,
				closedBefore: true
			});
			await dispatch();
			expect((await taskRow(task))['status']).toBe('done');
			expect(await runs.history(rule.id as string)).toEqual([
				expect.objectContaining({ outcome: TaskAutomationRunOutcomeEnum.APPLIED, taskId: task })
			]);

			// The merge delivered again, or a close without merging after it, appends nothing.
			await capture.handle(report(task, { merged: true }) as never);
			await capture.handle(report(task, { merged: false }) as never);
			expect(outbox.append).toHaveBeenCalledTimes(2);
			expect(await runs.history(rule.id as string)).toHaveLength(1);
		});

		it('runs a rule without the option on the first close only, and a merged-only rule on a merge or an issue’s close', async () => {
			const anyClose = await rules.create(scope, {
				name: 'Any close starts the task',
				trigger: { type: TaskAutomationTriggerEnum.LINK_CLOSED },
				actions: [
					{
						type: TaskAutomationActionEnum.SET_STATUS,
						category: TaskAutomationStatusCategoryEnum.IN_PROGRESS
					}
				]
			});
			const mergedOnly = await rules.create(scope, {
				name: 'A merge closes the task',
				trigger: { type: TaskAutomationTriggerEnum.LINK_CLOSED, mergedOnly: true },
				actions: [
					{ type: TaskAutomationActionEnum.SET_STATUS, category: TaskAutomationStatusCategoryEnum.DONE }
				]
			});
			const runsOf = async (rule: { id?: string }) => (await runs.history(rule.id as string)).length;
			const { capture, outbox, dispatch } = pipeline();

			// Closed without merging, then reopened and merged.
			const reopened = await createTask();
			await capture.handle(report(reopened, { merged: false }) as never);
			await dispatch();
			expect((await taskRow(reopened))['status']).toBe('in-progress');
			expect([await runsOf(anyClose), await runsOf(mergedOnly)]).toEqual([1, 0]);
			await capture.handle(report(reopened, { merged: true }) as never);
			await dispatch();
			expect((await taskRow(reopened))['status']).toBe('done');
			// The rule without the option ran on the close, as before: not again on the merge.
			expect([await runsOf(anyClose), await runsOf(mergedOnly)]).toEqual([1, 1]);

			// Merged at once: one event, both rules in their order.
			const merged = await createTask();
			await capture.handle(
				report(merged, {
					externalId: '9002',
					url: 'https://github.com/acme/site/pull/8',
					merged: true
				}) as never
			);
			expect(outbox.append).toHaveBeenCalledTimes(3);
			expect(outbox.append.mock.calls[2][1].data).toMatchObject({ merged: true, closedBefore: false });
			await dispatch();
			expect((await taskRow(merged))['status']).toBe('done');
			expect([await runsOf(anyClose), await runsOf(mergedOnly)]).toEqual([2, 2]);

			// An issue's close: the merged-only rule runs as without the option.
			const issue = await createTask();
			await capture.handle(
				report(issue, {
					kind: 'issue',
					externalId: '77',
					url: 'https://github.com/acme/site/issues/6',
					merged: undefined
				}) as never
			);
			await dispatch();
			expect((await taskRow(issue))['status']).toBe('done');
			expect([await runsOf(anyClose), await runsOf(mergedOnly)]).toEqual([3, 3]);
		});

		it('appends nothing for another tenant or organization, a missing task, or an organization without the rule', async () => {
			const { capture, outbox } = pipeline();
			const task = await createTask();

			// No link rule switched on in the organization yet.
			await capture.handle(report(task) as never);
			expect(outbox.append).not.toHaveBeenCalled();

			await rules.create(scope, { templateKey: 'link-closed-sets-status' });
			// The task is not of the scope the report names.
			await capture.handle(report(task, { tenantId: OTHER_TENANT }) as never);
			await capture.handle(report(task, { organizationId: OTHER_ORG }) as never);
			await capture.handle(report(randomUUID()) as never);
			expect(outbox.append).not.toHaveBeenCalled();
			expect(await dataSource.getRepository(TaskAutomationLinkClosure).count()).toBe(0);
			expect((await taskRow(task))['status']).toBe('open');

			// A report of the scope's own task goes through.
			await capture.handle(report(task) as never);
			expect(outbox.append).toHaveBeenCalledTimes(1);
		});

		it('leaves no claim when the append fails, so a later delivery of the close reports it', async () => {
			await rules.create(scope, { templateKey: 'link-closed-sets-status' });
			const task = await createTask();
			const { capture, outbox } = pipeline();
			outbox.append.mockRejectedValueOnce(new Error('database down'));
			await capture.handle(report(task) as never);
			// The claim was written in the append's transaction, and went with it.
			expect(await dataSource.getRepository(TaskAutomationLinkClosure).count()).toBe(0);
			await capture.handle(report(task) as never);
			expect(outbox.append).toHaveBeenCalledTimes(2);
			// The close, and the merge of the merged pull request (spec FR-21).
			expect(await dataSource.getRepository(TaskAutomationLinkClosure).count()).toBe(2);
		});

		it('claims in the MikroORM transaction the event is appended in, under DB_ORM=mikro-orm', async () => {
			await rules.create(scope, { templateKey: 'link-closed-sets-status' });
			const task = await createTask();
			// The SQL client a MikroORM transaction runs on, over the same database.
			const sql = knex({ client: 'better-sqlite3', connection: { filename: dataSource.options.database as string }, useNullAsDefault: true });
			const transactions: unknown[] = [];
			const em = {
				fork: () => ({
					transactional: (work: (transaction: unknown) => Promise<unknown>) =>
						sql.transaction((trx) => {
							const transaction = { getTransactionContext: () => trx, getKnex: () => sql };
							transactions.push(transaction);
							return work(transaction);
						})
				})
			};
			const appended: IOutboxWriteInput[] = [];
			const outbox = {
				mikroOrmEventOutboxRepository: { getEntityManager: () => em },
				append: jest.fn(async (transaction: unknown, input: IOutboxWriteInput) => {
					expect(transactions).toContain(transaction);
					appended.push(input);
					return {};
				})
			};
			const capture = new TaskAutomationLinkClosedCapture(rules, reader, new TaskAutomationLinkClosureStore(dataSource), outbox as never, dataSource);
			mockOrm.current = 'mikro-orm';
			try {
				outbox.append.mockRejectedValueOnce(new Error('database down'));
				await capture.handle(report(task) as never);
				expect(await dataSource.getRepository(TaskAutomationLinkClosure).count()).toBe(0);

				await capture.handle(report(task) as never);
				await capture.handle(report(task) as never);
				expect(appended).toHaveLength(1);
				expect(appended[0]).toMatchObject({ name: 'task_link.closed', aggregateId: task, tenantId: TENANT, organizationId: ORG });
				const rows = await dataSource.query(`SELECT * FROM "task_automation_link_closure" ORDER BY "kind"`);
				// The close, and the merge of the merged pull request (spec FR-21), both in the event's transaction.
				expect(rows).toEqual([
					expect.objectContaining({
						tenantId: TENANT,
						organizationId: ORG,
						taskId: task,
						provider: 'github',
						kind: 'pull_request',
						externalId: '9001'
					}),
					expect.objectContaining({
						tenantId: TENANT,
						organizationId: ORG,
						taskId: task,
						provider: 'github',
						kind: 'pull_request.merged',
						externalId: '9001'
					})
				]);
				expect(rows[0].createdAt).toBeTruthy();
			} finally {
				mockOrm.current = 'typeorm';
				await sql.destroy();
			}
		});

		it('drops at the consumer an event whose payload names another scope than its envelope', async () => {
			await rules.create(scope, { templateKey: 'link-closed-sets-status' });
			const task = await createTask();
			const { consumer } = pipeline();
			await consumer.handle({
				id: randomUUID(),
				name: 'task_link.closed',
				tenantId: OTHER_TENANT,
				organizationId: ORG,
				data: { taskId: task, tenantId: TENANT, organizationId: ORG, ...pullRequest }
			} as never);
			expect(writer.updates).toEqual([]);
			expect((await taskRow(task))['status']).toBe('open');
		});
	});

	describe('the writer, against a person’s edit made while a rule runs', () => {
		const TAG_URGENT = randomUUID();
		let realWriter: TaskAutomationWriter;
		let realRunner: TaskAutomationRunner;

		/** The platform's task update, as far as the lists go: the lists it is given replace the task's. */
		const commandBus = {
			execute: async (command: { id: string; input: Record<string, unknown> }) => {
				const repository = dataSource.getRepository(Task as never);
				const row = (await repository.findOne({ where: { id: command.id } as never, relations: { members: true, tags: true } as never })) as Record<string, unknown>;
				const fields = { ...command.input };
				delete fields['organizationId'];
				Object.assign(row, fields);
				return repository.save(row as never);
			}
		};

		/** Runs `edit` after the run read the task and before it writes (the rate-limit count sits between). */
		const editWhileRunning = (edit: () => Promise<unknown>) => {
			const count = runs.changesSince.bind(runs);
			jest.spyOn(runs, 'changesSince').mockImplementationOnce(async (...args: Parameters<typeof runs.changesSince>) => {
				await edit();
				return count(...args);
			});
		};

		const listsOf = async (id: string) => {
			const row = await taskRow(id);
			return {
				members: (row['members'] as Array<{ id: string }>).map((member) => member.id).sort(),
				tags: (row['tags'] as Array<{ id: string }>).map((tag) => tag.id).sort()
			};
		};

		beforeEach(async () => {
			await dataSource.getRepository(Tag as never).save({ id: TAG_URGENT, tenantId: TENANT, organizationId: ORG, name: 'Urgent' } as never);
			realWriter = new TaskAutomationWriter(commandBus as never, { publish: jest.fn() } as never, reader);
			realRunner = new TaskAutomationRunner(rules, runs, reader, realWriter, new TaskAutomationTaskLock(dataSource));
		});

		afterEach(() => {
			jest.restoreAllMocks();
		});

		it('does not put back an assignee removed after the run read the task', async () => {
			const rule = await rules.create(scope, {
				name: 'Bob joins started tasks',
				trigger: { type: TaskAutomationTriggerEnum.STATUS_CHANGED },
				actions: [{ type: TaskAutomationActionEnum.ADD_ASSIGNEES, employeeIds: [BOB] }]
			});
			const id = await createTask();
			await dataSource.query(`INSERT INTO "task_employee" ("taskId", "employeeId") VALUES (?, ?)`, [id, ADA]);
			// A person unassigns Ada while the rule runs.
			editWhileRunning(() => dataSource.query(`DELETE FROM "task_employee" WHERE "taskId" = ? AND "employeeId" = ?`, [id, ADA]));

			const result = await realRunner.run(rule, id as never, { eventKey: `e-1:${id}`, triggerType: TaskAutomationTriggerEnum.STATUS_CHANGED, depth: 0, chain: [] });

			expect(result.outcome).toBe(TaskAutomationRunOutcomeEnum.APPLIED);
			expect((await listsOf(id)).members).toEqual([BOB]);
		});

		it('keeps a label added after the run read the task', async () => {
			const rule = await rules.create(scope, {
				name: 'Review started tasks',
				trigger: { type: TaskAutomationTriggerEnum.STATUS_CHANGED },
				actions: [{ type: TaskAutomationActionEnum.ADD_LABELS, tagIds: [TAG_REVIEW] }]
			});
			const id = await createTask();
			editWhileRunning(() => dataSource.query(`INSERT INTO "tag_task" ("taskId", "tagId") VALUES (?, ?)`, [id, TAG_URGENT]));

			await realRunner.run(rule, id as never, { eventKey: `e-2:${id}`, triggerType: TaskAutomationTriggerEnum.STATUS_CHANGED, depth: 0, chain: [] });

			expect((await listsOf(id)).tags).toEqual([TAG_REVIEW, TAG_URGENT].sort());
		});

		it('records no change, and counts none toward the rate limit, when the edit made meanwhile already did it', async () => {
			const rule = await rules.create(scope, {
				name: 'Bob joins started tasks',
				trigger: { type: TaskAutomationTriggerEnum.STATUS_CHANGED },
				actions: [{ type: TaskAutomationActionEnum.ADD_ASSIGNEES, employeeIds: [BOB] }]
			});
			const id = await createTask();
			// A person assigns Bob while the rule runs.
			editWhileRunning(() => dataSource.query(`INSERT INTO "task_employee" ("taskId", "employeeId") VALUES (?, ?)`, [id, BOB]));

			const result = await realRunner.run(rule, id as never, { eventKey: `e-4:${id}`, triggerType: TaskAutomationTriggerEnum.STATUS_CHANGED, depth: 0, chain: [] });

			expect(result.outcome).toBe(TaskAutomationRunOutcomeEnum.NO_CHANGE);
			expect(await runs.changesSince(id as never, new Date(Date.now() - 60_000))).toBe(0);
			const [run] = await runs.history(rule.id as string);
			expect((run.details as { changes: Array<{ field: string; note?: string }> }).changes).toEqual([
				expect.objectContaining({ field: 'members', note: 'Already set.' })
			]);
			expect((await listsOf(id)).members).toEqual([BOB]);
		});

		it('sends a notice to the assignees as they are once the rule’s edit is applied to the task as it is now', async () => {
			const rule = await rules.create(scope, {
				name: 'Bob joins, then everyone hears',
				trigger: { type: TaskAutomationTriggerEnum.STATUS_CHANGED },
				actions: [
					{ type: TaskAutomationActionEnum.ADD_ASSIGNEES, employeeIds: [BOB] },
					{ type: TaskAutomationActionEnum.NOTIFY_ASSIGNEES, message: 'Started' }
				]
			});
			const id = await createTask();
			await dataSource.query(`INSERT INTO "task_employee" ("taskId", "employeeId") VALUES (?, ?)`, [id, ADA]);
			const notified: string[][] = [];
			jest.spyOn(realWriter, 'notify').mockImplementation(async (_task, notice) => {
				notified.push([...notice.employeeIds].sort());
				return { channel: 'inbox', recipients: notice.employeeIds.length };
			});
			// A person unassigns Ada while the rule runs: she is not told, Bob is.
			editWhileRunning(() => dataSource.query(`DELETE FROM "task_employee" WHERE "taskId" = ? AND "employeeId" = ?`, [id, ADA]));

			await realRunner.run(rule, id as never, { eventKey: `e-5:${id}`, triggerType: TaskAutomationTriggerEnum.STATUS_CHANGED, depth: 0, chain: [] });

			expect((await listsOf(id)).members).toEqual([BOB]);
			expect(notified).toEqual([[BOB]]);
		});

		it('sends a notice to the assignees as stored now when the rule changes no list', async () => {
			const rule = await rules.create(scope, {
				name: 'Everyone hears',
				trigger: { type: TaskAutomationTriggerEnum.STATUS_CHANGED },
				actions: [{ type: TaskAutomationActionEnum.NOTIFY_ASSIGNEES, message: 'Started' }]
			});
			const id = await createTask();
			await dataSource.query(`INSERT INTO "task_employee" ("taskId", "employeeId") VALUES (?, ?)`, [id, ADA]);
			const notified: string[][] = [];
			jest.spyOn(realWriter, 'notify').mockImplementation(async (_task, notice) => {
				notified.push([...notice.employeeIds].sort());
				return { channel: 'inbox', recipients: notice.employeeIds.length };
			});
			// A person assigns Bob while the rule runs: he hears too.
			editWhileRunning(() => dataSource.query(`INSERT INTO "task_employee" ("taskId", "employeeId") VALUES (?, ?)`, [id, BOB]));

			await realRunner.run(rule, id as never, { eventKey: `e-6:${id}`, triggerType: TaskAutomationTriggerEnum.STATUS_CHANGED, depth: 0, chain: [] });

			expect(notified).toEqual([[ADA, BOB].sort()]);
		});

		it('sends no notice about a task deleted while the rule runs', async () => {
			const rule = await rules.create(scope, {
				name: 'Everyone hears',
				trigger: { type: TaskAutomationTriggerEnum.STATUS_CHANGED },
				actions: [{ type: TaskAutomationActionEnum.NOTIFY_ASSIGNEES, message: 'Started' }]
			});
			const id = await createTask();
			await dataSource.query(`INSERT INTO "task_employee" ("taskId", "employeeId") VALUES (?, ?)`, [id, ADA]);
			const notify = jest.spyOn(realWriter, 'notify');
			editWhileRunning(() => dataSource.getRepository(Task as never).softDelete({ id } as never));

			const result = await realRunner.run(rule, id as never, { eventKey: `e-7:${id}`, triggerType: TaskAutomationTriggerEnum.STATUS_CHANGED, depth: 0, chain: [] });

			expect(notify).not.toHaveBeenCalled();
			expect(result.outcome).toBe(TaskAutomationRunOutcomeEnum.NO_CHANGE);
			const [run] = await runs.history(rule.id as string);
			expect((run.details as { changes: Array<{ field: string; note?: string }> }).changes).toEqual([
				expect.objectContaining({ field: 'notice', to: 0, note: 'The task no longer exists.' })
			]);
		});

		it('writes the plan as it is when nothing changed meanwhile', async () => {
			const rule = await rules.create(scope, {
				name: 'Bob replaces Ada',
				trigger: { type: TaskAutomationTriggerEnum.STATUS_CHANGED },
				actions: [{ type: TaskAutomationActionEnum.SET_ASSIGNEES, employeeIds: [BOB] }]
			});
			const id = await createTask();
			await dataSource.query(`INSERT INTO "task_employee" ("taskId", "employeeId") VALUES (?, ?)`, [id, ADA]);

			await realRunner.run(rule, id as never, { eventKey: `e-3:${id}`, triggerType: TaskAutomationTriggerEnum.STATUS_CHANGED, depth: 0, chain: [] });

			expect((await listsOf(id)).members).toEqual([BOB]);
			expect(await reader.lists(TENANT as never, id as never)).toEqual({ memberIds: [BOB], tagIds: [] });
			expect(await reader.lists(OTHER_TENANT as never, id as never)).toBeNull();
		});
	});

	describe('due-date sweep', () => {
		it('notifies the assignees of an open task once per due date, and not a done one or the backlog before the rule', async () => {
			const rule = await rules.create(scope, { templateKey: 'due-date-notify-assignees' });
			const now = new Date(Date.now() + 60 * 60_000);
			const due = new Date(Date.now() + 30 * 60_000);
			const open = await createTask({ dueDate: due });
			await dataSource.query(`INSERT INTO "task_employee" ("taskId", "employeeId") VALUES (?, ?)`, [open, ADA]);
			const done = await createTask({ dueDate: due, status: 'done', taskStatusId: 'st-done' });
			await dataSource.query(`INSERT INTO "task_employee" ("taskId", "employeeId") VALUES (?, ?)`, [done, ADA]);
			// Due before the rule existed: not reported.
			await createTask({ dueDate: new Date(Date.now() - 60 * 60_000) });

			const sweeps = new TaskAutomationDueSweepService(dataSource, rules, reader, runner, runs);
			expect(await sweeps.sweep(now)).toEqual({ rules: 1, runs: 1 });
			expect(writer.notices).toEqual([{ taskId: open, employeeIds: [ADA], eventKey: dueEventKey(open, due) }]);
			// Again: the due date was reported.
			expect(await sweeps.sweep(now)).toEqual({ rules: 1, runs: 0 });
			expect(writer.notices).toHaveLength(1);
			expect((await runs.history(rule.id as string))[0].outcome).toBe(TaskAutomationRunOutcomeEnum.APPLIED);
		});

		it('reads due tasks a page at a time, by due date then id, past the last task of the page before', async () => {
			const due = new Date(Date.now() - 10 * 60_000);
			const ids = [await createTask({ dueDate: due }), await createTask({ dueDate: due }), await createTask({ dueDate: new Date(Date.now() - 5 * 60_000) })];
			const ordered = [...ids.slice(0, 2).sort(), ids[2]];
			const window = { after: new Date(Date.now() - 60 * 60_000), until: new Date() };
			const first = await reader.dueTasks({ tenantId: TENANT, organizationId: ORG }, window, 2);
			expect(first.map((task) => task.id)).toEqual(ordered.slice(0, 2));
			const second = await reader.dueTasks({ tenantId: TENANT, organizationId: ORG }, window, 2, first[1]);
			expect(second.map((task) => task.id)).toEqual([ordered[2]]);
		});
	});

	describe('due tasks a rule already reported', () => {
		it('are left out of the read, so tasks that stay open never fill the pages; a run still going is not', async () => {
			const rule = await rules.create(scope, { templateKey: 'due-date-notify-assignees' });
			const due = new Date(Date.now() - 10 * 60_000);
			const reported = await createTask({ dueDate: due });
			const going = await createTask({ dueDate: due });
			const fresh = await createTask({ dueDate: due });
			const claim = (taskId: string) =>
				runs.claim({
					tenantId: TENANT,
					organizationId: ORG,
					ruleId: rule.id as string,
					taskId,
					eventKey: dueEventKey(taskId, due),
					triggerType: TaskAutomationTriggerEnum.DUE_DATE_PASSED,
					depth: 0
				});
			await runs.finish((await claim(reported))!, TaskAutomationRunOutcomeEnum.APPLIED);
			await claim(going);
			const window = { after: new Date(Date.now() - 60 * 60_000), until: new Date() };
			const ids = (await reader.dueTasks({ tenantId: TENANT, organizationId: ORG, ruleId: rule.id as string }, window, 10)).map((task) => task.id);
			expect(ids.sort()).toEqual([going, fresh].sort());
			// Without the rule, every open due task is read.
			expect((await reader.dueTasks({ tenantId: TENANT, organizationId: ORG }, window, 10)).length).toBe(3);
			// A due date corrected after the notice (a change of the task) brings the task back: its new key decides.
			// (Its change time is stated: SQLite keeps whole seconds, and the correction comes a moment after the notice.)
			const corrected = new Date(due.getTime() - 5 * 60_000);
			await dataSource
				.getRepository(Task as never)
				.update({ id: reported } as never, { dueDate: corrected, updatedAt: new Date(Date.now() + 2_000) } as never);
			const again = (await reader.dueTasks({ tenantId: TENANT, organizationId: ORG, ruleId: rule.id as string }, window, 10)).map((task) => task.id);
			expect(again.sort()).toEqual([reported, going, fresh].sort());
			expect([...(await runs.finishedKeys(rule.id as string, [dueEventKey(reported, corrected)]))]).toEqual([]);
		});
	});

	describe('task lock', () => {
		it('runs one rule of a task at a time: a second run waits, or is put back for later', async () => {
			const lock = new TaskAutomationTaskLock(dataSource);
			let release!: () => void;
			const holding = lock.run('task-1', () => new Promise<void>((resolve) => (release = resolve)));
			await expect(lock.run('task-1', async () => 'x', 0)).rejects.toBeInstanceOf(TaskAutomationRetryLaterError);
			// Another task is not held up.
			await expect(lock.run('task-2', async () => 'y', 0)).resolves.toBe('y');
			const waiting = lock.run('task-1', async () => 'z', 5_000);
			release();
			await holding;
			await expect(waiting).resolves.toBe('z');
		});
	});
});
