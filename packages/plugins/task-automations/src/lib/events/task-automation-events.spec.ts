/**
 * The capture (activity fact → outbox), the consumer (outbox → engine) and the attribution of activity rows, with
 * `@gauzy/core` doubled at the module boundary (its barrel boots the whole application).
 */
const mockUser: { current: Record<string, unknown> | null } = { current: null };

jest.mock('@gauzy/core', () => {
	class ActivityLogEvent {
		constructor(public readonly input: unknown) {}
	}
	class TaskLinkClosedEvent {
		constructor(public readonly input: unknown) {}
	}
	class BaseEntityEventSubscriber {}
	return {
		ActivityLogEvent,
		TaskLinkClosedEvent,
		ActivityLog: class ActivityLog {},
		BaseEntityEventSubscriber,
		EventOutboxService: class EventOutboxService {},
		EventConsumerRegistry: class EventConsumerRegistry {
			static consumerKeyOf(consumer: { kind?: string; key: string }) {
				return `${consumer.kind}:${consumer.key}`;
			}
		},
		MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
		getORMType: () => 'typeorm',
		RequestContext: {
			currentUser: () => mockUser.current,
			currentUserId: () => (mockUser.current?.['id'] as string) ?? null
		}
	};
});

// The services are injected by type only: their own module graphs (entities, repositories) stay out of this suite.
jest.mock('../services/task-automation-rule.service', () => ({ TaskAutomationRuleService: class TaskAutomationRuleService {} }));
jest.mock('../services/task-automation-engine.service', () => ({ TaskAutomationEngine: class TaskAutomationEngine {} }));
jest.mock('../services/task-automation-link-closure.store', () => ({ TaskAutomationLinkClosureStore: class TaskAutomationLinkClosureStore {} }));
jest.mock('../services/task-automation-task-reader.service', () => ({ TaskAutomationTaskReader: class TaskAutomationTaskReader {} }));

import 'reflect-metadata';
import { ActionTypeEnum, ActorTypeEnum, BaseEntityEnum, TASK_AUTOMATION_EVENT_NAMES, TaskAutomationTriggerEnum } from '@gauzy/contracts';
import { ActivityLogEvent, TaskLinkClosedEvent } from '@gauzy/core';
import {
	ITaskLinkClosureKey,
	linkClosureKeyOf,
	linkMergeKeyOf,
	TASK_LINK_MERGE_CLAIM_KIND
} from '../engine/link-closed';
import { TaskAutomationChangeCapture } from './task-automation-change.capture';
import { parseLinkClosedEvent, TaskAutomationEventConsumer } from './task-automation-event.consumer';
import { TaskAutomationLinkClosedCapture } from './task-automation-link-closed.capture';
import { attributeActivity, attributedDescription } from './task-automation-activity.subscriber';

const statusFact = {
	entity: BaseEntityEnum.Task,
	entityId: 'task-1',
	action: ActionTypeEnum.Updated,
	tenantId: 'tenant-1',
	organizationId: 'org-1',
	previousValues: [{ status: 'open' }],
	updatedValues: [{ status: 'done' }]
};

describe('TaskAutomationChangeCapture', () => {
	const setup = (triggers: string[]) => {
		const rules = { enabledTriggers: jest.fn(async () => new Set(triggers)) };
		const outbox = { append: jest.fn(async () => ({})) };
		// The append runs in a transaction of its own; `manager` is that transaction's.
		const manager = {};
		const dataSource = { manager: { transaction: jest.fn(async (work: (manager: unknown) => Promise<unknown>) => work(manager)) } };
		const capture = new TaskAutomationChangeCapture(rules as never, outbox as never, dataSource as never);
		return { capture, rules, outbox, manager };
	};

	beforeEach(() => {
		mockUser.current = { id: 'user-1', tenantId: 'tenant-1' };
	});

	it('appends a status change of an organization that has a status rule, in the task’s own partition', async () => {
		const { capture, outbox, manager } = setup([TaskAutomationTriggerEnum.STATUS_CHANGED]);
		await capture.handle(new ActivityLogEvent(statusFact as never));
		expect(outbox.append).toHaveBeenCalledWith(
			manager,
			expect.objectContaining({
				name: TASK_AUTOMATION_EVENT_NAMES.TASK_CHANGED,
				aggregateType: 'task',
				aggregateId: 'task-1',
				partitionKey: 'task-automation:task-1',
				tenantId: 'tenant-1',
				organizationId: 'org-1',
				headers: { actorUserId: 'user-1' },
				data: expect.objectContaining({ action: 'updated', depth: 0, chain: [], changes: { status: { from: 'open', to: 'done' } } })
			})
		);
	});

	it('appends nothing when no rule of the organization could fire, or nothing a trigger reads changed', async () => {
		const assignOnly = setup([TaskAutomationTriggerEnum.TASK_ASSIGNED]);
		await assignOnly.capture.handle(new ActivityLogEvent(statusFact as never));
		expect(assignOnly.outbox.append).not.toHaveBeenCalled();

		const titled = setup([TaskAutomationTriggerEnum.STATUS_CHANGED]);
		await titled.capture.handle(new ActivityLogEvent({ ...statusFact, previousValues: [{ title: 'a' }], updatedValues: [{ title: 'b' }] } as never));
		expect(titled.rules.enabledTriggers).not.toHaveBeenCalled();
		expect(titled.outbox.append).not.toHaveBeenCalled();

		const other = setup([TaskAutomationTriggerEnum.STATUS_CHANGED]);
		await other.capture.handle(new ActivityLogEvent({ ...statusFact, entity: BaseEntityEnum.Document } as never));
		expect(other.outbox.append).not.toHaveBeenCalled();
	});

	it('carries an automation’s depth and chain, and drops a change deeper than the guard ever evaluates', async () => {
		const { capture, outbox } = setup([TaskAutomationTriggerEnum.STATUS_CHANGED]);
		mockUser.current = { tenantId: 'tenant-1', taskAutomation: { ruleId: 'rule-a', ruleName: 'A', runId: 'run-1', depth: 1, chain: ['rule-a'] } };
		await capture.handle(new ActivityLogEvent(statusFact as never));
		expect(outbox.append).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				headers: { causationId: 'run-1' },
				data: expect.objectContaining({ depth: 1, chain: ['rule-a'], actorUserId: null })
			})
		);
		outbox.append.mockClear();
		mockUser.current = { tenantId: 'tenant-1', taskAutomation: { ruleId: 'rule-b', ruleName: 'B', runId: 'run-2', depth: 3, chain: ['a', 'b', 'c'] } };
		await capture.handle(new ActivityLogEvent(statusFact as never));
		expect(outbox.append).not.toHaveBeenCalled();
	});

	it('never throws: a failed append is logged, the task’s save is not touched', async () => {
		const { capture, outbox } = setup([TaskAutomationTriggerEnum.STATUS_CHANGED]);
		outbox.append.mockRejectedValueOnce(new Error('database down'));
		await expect(capture.handle(new ActivityLogEvent(statusFact as never))).resolves.toBeUndefined();
	});
});

describe('TaskAutomationLinkClosedCapture', () => {
	const closed = {
		taskId: 'task-1',
		tenantId: 'tenant-1',
		organizationId: 'org-1',
		provider: 'GitHub',
		kind: 'pull_request',
		url: 'https://github.com/acme/site/pull/7',
		externalId: '9001',
		merged: true
	};

	const setup = (triggers: string[], claimed = true, owned = true) => {
		const rules = { enabledTriggers: jest.fn(async () => new Set(triggers)) };
		const reader = { belongsTo: jest.fn(async () => owned) };
		const closures = {
			claimIn: jest.fn<Promise<boolean>, [unknown, ITaskLinkClosureKey]>(async () => claimed),
			claimInMikroOrm: jest.fn(async () => claimed),
			exists: jest.fn<Promise<boolean>, [ITaskLinkClosureKey]>(async () => false)
		};
		const outbox = { append: jest.fn<Promise<unknown>, [unknown, unknown]>(async () => ({})) };
		// The claim and the append run in one transaction; `manager` is that transaction's.
		const manager = {};
		const dataSource = { manager: { transaction: jest.fn(async (work: (manager: unknown) => Promise<unknown>) => work(manager)) } };
		const capture = new TaskAutomationLinkClosedCapture(rules as never, reader as never, closures as never, outbox as never, dataSource as never);
		return { capture, rules, reader, closures, outbox, manager };
	};

	const closeKey = {
		tenantId: 'tenant-1',
		organizationId: 'org-1',
		taskId: 'task-1',
		provider: 'github',
		kind: 'pull_request',
		externalId: '9001'
	};
	const mergeKey = { ...closeKey, kind: TASK_LINK_MERGE_CLAIM_KIND };

	it('claims and appends a closed link in one transaction, in the task’s own partition, with its scope and identity', async () => {
		const { capture, closures, outbox, manager, rules } = setup([TaskAutomationTriggerEnum.LINK_CLOSED]);
		await capture.handle(new TaskLinkClosedEvent(closed as never) as never);
		expect(rules.enabledTriggers).toHaveBeenCalledWith('tenant-1', 'org-1');
		// The close, and the merge of the merged pull request beside it.
		expect(closures.claimIn.mock.calls).toEqual([
			[manager, closeKey],
			[manager, mergeKey]
		]);
		expect(outbox.append).toHaveBeenCalledTimes(1);
		expect(outbox.append).toHaveBeenCalledWith(manager, {
			name: TASK_AUTOMATION_EVENT_NAMES.LINK_CLOSED,
			aggregateType: 'task',
			aggregateId: 'task-1',
			partitionKey: 'task-automation:task-1',
			tenantId: 'tenant-1',
			organizationId: 'org-1',
			data: { ...closed, provider: 'github', closedBefore: false }
		});
	});

	it('claims no merge for a close without merging or an issue, so a later merge is still reported (spec FR-21)', async () => {
		const unmerged = setup([TaskAutomationTriggerEnum.LINK_CLOSED]);
		expect(await unmerged.capture.report({ ...closed, merged: false })).toBe(true);
		expect(unmerged.closures.claimIn.mock.calls).toEqual([[unmerged.manager, closeKey]]);
		expect(unmerged.outbox.append.mock.calls[0][1]).toMatchObject({ data: { merged: false, closedBefore: false } });

		const issue = setup([TaskAutomationTriggerEnum.LINK_CLOSED]);
		expect(await issue.capture.report({ ...closed, kind: 'issue', merged: true })).toBe(true);
		expect(issue.closures.claimIn.mock.calls).toEqual([[issue.manager, { ...closeKey, kind: 'issue' }]]);
	});

	it('appends a merge whose close was reported before, saying so; an integration cannot say it for the claims', async () => {
		const { capture, closures, outbox, manager } = setup([TaskAutomationTriggerEnum.LINK_CLOSED]);
		// The close was claimed when the pull request closed without merging; its merge is new.
		closures.claimIn.mockImplementation(
			async (_manager: unknown, key: ITaskLinkClosureKey) => key.kind === TASK_LINK_MERGE_CLAIM_KIND
		);
		expect(await capture.report({ ...closed, closedBefore: false })).toBe(true);
		expect(outbox.append).toHaveBeenCalledWith(
			manager,
			expect.objectContaining({ data: expect.objectContaining({ merged: true, closedBefore: true }) })
		);

		// Both claimed before: the same merge delivered again appends nothing.
		closures.claimIn.mockResolvedValue(false);
		expect(await capture.report(closed)).toBe(false);
		expect(outbox.append).toHaveBeenCalledTimes(1);

		// A first close an integration calls a repeat is still the first close.
		const fresh = setup([TaskAutomationTriggerEnum.LINK_CLOSED]);
		await fresh.capture.report({ ...closed, merged: false, closedBefore: true });
		expect(fresh.outbox.append.mock.calls[0][1]).toMatchObject({ data: { closedBefore: false } });
	});

	it('appends nothing for a link reported before, a task not of the scope, or an organization without a link rule', async () => {
		const again = setup([TaskAutomationTriggerEnum.LINK_CLOSED], false);
		expect(await again.capture.report(closed)).toBe(false);
		expect(again.outbox.append).not.toHaveBeenCalled();

		const foreign = setup([TaskAutomationTriggerEnum.LINK_CLOSED], true, false);
		expect(await foreign.capture.report(closed)).toBe(false);
		expect(foreign.reader.belongsTo).toHaveBeenCalledWith('tenant-1', 'org-1', 'task-1');
		// A scope the task is not of never reaches the organization's cached triggers.
		expect(foreign.rules.enabledTriggers).not.toHaveBeenCalled();
		expect(foreign.closures.claimIn).not.toHaveBeenCalled();
		expect(foreign.outbox.append).not.toHaveBeenCalled();

		const statusOnly = setup([TaskAutomationTriggerEnum.STATUS_CHANGED]);
		expect(await statusOnly.capture.report(closed)).toBe(false);
		expect(statusOnly.closures.claimIn).not.toHaveBeenCalled();
		expect(statusOnly.outbox.append).not.toHaveBeenCalled();
	});

	it('drops a report with no task, scope, kind, provider or item to tell it by', async () => {
		const { capture, rules, outbox } = setup([TaskAutomationTriggerEnum.LINK_CLOSED]);
		for (const report of [
			{ ...closed, taskId: undefined },
			{ ...closed, organizationId: '' },
			{ ...closed, kind: 'commit' },
			{ ...closed, provider: ' ' },
			{ ...closed, externalId: null, url: null },
			{ ...closed, externalId: 'x'.repeat(256) },
			null
		]) {
			expect(await capture.report(report)).toBe(false);
		}
		expect(rules.enabledTriggers).not.toHaveBeenCalled();
		expect(outbox.append).not.toHaveBeenCalled();
	});

	it('fails the transaction when the append fails (its claim goes with it), and never throws to the integration', async () => {
		const { capture, closures, outbox } = setup([TaskAutomationTriggerEnum.LINK_CLOSED]);
		outbox.append.mockRejectedValueOnce(new Error('database down'));
		await expect(capture.report(closed)).rejects.toThrow('database down');
		expect(closures.exists).toHaveBeenCalled();
		outbox.append.mockRejectedValueOnce(new Error('database down'));
		await expect(capture.handle(new TaskLinkClosedEvent(closed as never) as never)).resolves.toBeUndefined();
	});

	it('appends nothing when another delivery committed the claim first (the unique key failed the insert)', async () => {
		const { capture, closures, outbox } = setup([TaskAutomationTriggerEnum.LINK_CLOSED]);
		closures.claimIn.mockRejectedValueOnce(new Error('UNIQUE constraint failed'));
		closures.exists.mockResolvedValueOnce(true);
		expect(await capture.report(closed)).toBe(false);
		// A merge is another delivery's when its merge is claimed; a close when its close is.
		expect(closures.exists).toHaveBeenCalledWith(mergeKey);
		expect(outbox.append).not.toHaveBeenCalled();

		const unmerged = setup([TaskAutomationTriggerEnum.LINK_CLOSED]);
		unmerged.closures.claimIn.mockRejectedValueOnce(new Error('UNIQUE constraint failed'));
		unmerged.closures.exists.mockResolvedValueOnce(true);
		expect(await unmerged.capture.report({ ...closed, merged: false })).toBe(false);
		expect(unmerged.closures.exists).toHaveBeenCalledWith(closeKey);
	});

	it('tries a merge once more when a close without merging claimed the close meanwhile, and appends it as a merge after a close', async () => {
		const { capture, closures, outbox, manager } = setup([TaskAutomationTriggerEnum.LINK_CLOSED]);
		// The close without merging committed its claim between this delivery's lookup and its insert.
		closures.claimIn.mockRejectedValueOnce(new Error('UNIQUE constraint failed'));
		closures.exists.mockImplementation(async (key: ITaskLinkClosureKey) => key.kind !== TASK_LINK_MERGE_CLAIM_KIND);
		closures.claimIn.mockImplementation(
			async (_manager: unknown, key: ITaskLinkClosureKey) => key.kind === TASK_LINK_MERGE_CLAIM_KIND
		);
		expect(await capture.report(closed)).toBe(true);
		expect(closures.claimIn.mock.calls.map(([, key]) => key.kind)).toEqual([
			'pull_request',
			'pull_request',
			TASK_LINK_MERGE_CLAIM_KIND
		]);
		expect(outbox.append).toHaveBeenCalledTimes(1);
		expect(outbox.append).toHaveBeenCalledWith(
			manager,
			expect.objectContaining({ data: expect.objectContaining({ merged: true, closedBefore: true }) })
		);

		// A close without merging that loses the same race is the other delivery's: not tried again.
		const unmerged = setup([TaskAutomationTriggerEnum.LINK_CLOSED]);
		unmerged.closures.claimIn.mockRejectedValueOnce(new Error('UNIQUE constraint failed'));
		unmerged.closures.exists.mockResolvedValue(true);
		expect(await unmerged.capture.report({ ...closed, merged: false })).toBe(false);
		expect(unmerged.closures.claimIn).toHaveBeenCalledTimes(1);
	});

	it('throws a merge’s failed append though its close was claimed long before, so the merge is not lost as a repeat', async () => {
		const { capture, closures, outbox } = setup([TaskAutomationTriggerEnum.LINK_CLOSED]);
		closures.claimIn.mockImplementation(
			async (_manager: unknown, key: ITaskLinkClosureKey) => key.kind === TASK_LINK_MERGE_CLAIM_KIND
		);
		closures.exists.mockImplementation(async (key: ITaskLinkClosureKey) => key.kind !== TASK_LINK_MERGE_CLAIM_KIND);
		outbox.append.mockRejectedValue(new Error('database down'));
		await expect(capture.report(closed)).rejects.toThrow('database down');
		expect(closures.exists).toHaveBeenCalledWith(mergeKey);
		// Tried once more (the close's claim could have been another delivery's), then given up.
		expect(outbox.append).toHaveBeenCalledTimes(2);
	});

	it('tells a link by its provider’s id, else its address; the provider in lower case', () => {
		const event = parseLinkClosedEvent(closed) as NonNullable<ReturnType<typeof parseLinkClosedEvent>>;
		expect(event.merged).toBe(true);
		expect(parseLinkClosedEvent({ ...closed, merged: 'yes' })?.merged).toBeUndefined();
		expect(linkClosureKeyOf(event)).toMatchObject({ provider: 'github', externalId: '9001' });
		expect(linkClosureKeyOf({ ...event, externalId: null })).toMatchObject({ externalId: closed.url });
		expect(linkClosureKeyOf({ ...event, provider: 'p'.repeat(33) })).toBeNull();
		expect(parseLinkClosedEvent({ ...closed, closedBefore: true })?.closedBefore).toBe(true);
		expect(parseLinkClosedEvent({ ...closed, closedBefore: 'yes' })?.closedBefore).toBeUndefined();
		// The merge's claim: a merged pull request's only, under its own kind, which fits the column.
		const key = linkClosureKeyOf(event) as NonNullable<ReturnType<typeof linkClosureKeyOf>>;
		expect(linkMergeKeyOf(event, key)).toEqual({ ...key, kind: TASK_LINK_MERGE_CLAIM_KIND });
		expect(linkMergeKeyOf({ ...event, merged: false }, key)).toBeNull();
		expect(linkMergeKeyOf({ kind: 'issue', merged: true }, key)).toBeNull();
		expect(TASK_LINK_MERGE_CLAIM_KIND.length).toBeLessThanOrEqual(24);
	});
});

describe('TaskAutomationEventConsumer', () => {
	const setup = () => {
		const registry = { register: jest.fn(), list: jest.fn((): unknown[] => []) };
		const engine = { processChange: jest.fn(async () => 1), processLinkClosed: jest.fn(async () => 1) };
		const consumer = new TaskAutomationEventConsumer(registry as never, engine as never);
		return { consumer, registry, engine };
	};
	const change = { taskId: 'task-1', tenantId: 'tenant-1', organizationId: 'org-1', action: 'updated', changes: {}, depth: 0, chain: [] };

	it('registers itself for the change and link events', () => {
		const { consumer, registry } = setup();
		consumer.onApplicationBootstrap();
		expect(registry.register).toHaveBeenCalledWith(consumer);
		expect(consumer.events).toEqual([TASK_AUTOMATION_EVENT_NAMES.TASK_CHANGED, TASK_AUTOMATION_EVENT_NAMES.LINK_CLOSED]);
		expect(consumer.key).toBe('task-automations');
	});

	it('fails the boot when it cannot register, unless another instance of itself serves the key', () => {
		const { consumer, registry } = setup();
		registry.register.mockImplementationOnce(() => {
			throw new Error('The event consumer "subscriber:task-automations" is already registered.');
		});
		expect(() => consumer.onApplicationBootstrap()).toThrow(/already registered/);
		const twin = setup();
		twin.registry.list.mockReturnValue([consumer]);
		twin.consumer.onApplicationBootstrap();
		expect(twin.registry.register).not.toHaveBeenCalled();
	});

	it('hands a change to the engine with the event’s id', async () => {
		const { consumer, engine } = setup();
		await consumer.handle({ id: 'event-1', name: TASK_AUTOMATION_EVENT_NAMES.TASK_CHANGED, tenantId: 'tenant-1', organizationId: 'org-1', data: change } as never);
		expect(engine.processChange).toHaveBeenCalledWith('event-1', expect.objectContaining({ taskId: 'task-1' }));
	});

	it('drops a payload whose scope is not its envelope’s, and one that is no change', async () => {
		const { consumer, engine } = setup();
		await consumer.handle({ id: 'e', name: TASK_AUTOMATION_EVENT_NAMES.TASK_CHANGED, tenantId: 'tenant-2', data: change } as never);
		await consumer.handle({ id: 'e', name: TASK_AUTOMATION_EVENT_NAMES.TASK_CHANGED, tenantId: 'tenant-1', organizationId: 'org-2', data: change } as never);
		await consumer.handle({ id: 'e', name: TASK_AUTOMATION_EVENT_NAMES.TASK_CHANGED, data: { nope: true } } as never);
		expect(engine.processChange).not.toHaveBeenCalled();
	});

	it('hands a closed link to the engine', async () => {
		const { consumer, engine } = setup();
		const closed = { taskId: 'task-1', tenantId: 'tenant-1', organizationId: 'org-1', provider: 'github', kind: 'pull_request', url: 'https://example.com/pr/1' };
		await consumer.handle({ id: 'event-2', name: TASK_AUTOMATION_EVENT_NAMES.LINK_CLOSED, tenantId: 'tenant-1', data: closed } as never);
		expect(engine.processLinkClosed).toHaveBeenCalledWith('event-2', expect.objectContaining({ taskId: 'task-1', provider: 'github' }));
		expect(parseLinkClosedEvent({ taskId: 'x' })).toBeNull();
		expect(parseLinkClosedEvent({ ...closed, kind: 'issue' })?.kind).toBe('issue');
		// A kind the contract does not name is no closed link.
		expect(parseLinkClosedEvent({ ...closed, kind: 'unknown' })).toBeNull();
		expect(parseLinkClosedEvent({ ...closed, kind: undefined })).toBeNull();
	});

	it('lets an engine failure through, so the delivery is tried again', async () => {
		const { consumer, engine } = setup();
		engine.processChange.mockRejectedValueOnce(new Error('claim failed'));
		await expect(
			consumer.handle({ id: 'e', name: TASK_AUTOMATION_EVENT_NAMES.TASK_CHANGED, tenantId: 'tenant-1', data: change } as never)
		).rejects.toThrow('claim failed');
	});
});

describe('activity attribution', () => {
	const marker = { ruleId: 'rule-a', ruleName: 'Close parents', runId: 'run-1', depth: 1, chain: ['rule-a'] };

	it('names the rule and the system actor on a task’s activity row written by a rule', () => {
		const row = { entity: BaseEntityEnum.Task, actorType: ActorTypeEnum.User, description: 'Updated Task "Parent"' };
		attributeActivity(row as never, marker);
		expect(row).toEqual({ entity: BaseEntityEnum.Task, actorType: ActorTypeEnum.System, description: 'Updated Task "Parent" by automation "Close parents"' });
		// Twice is once.
		attributeActivity(row as never, marker);
		expect(row.description).toBe('Updated Task "Parent" by automation "Close parents"');
	});

	it('leaves a person’s rows and other entities as they are', () => {
		const person = { entity: BaseEntityEnum.Task, actorType: ActorTypeEnum.User, description: 'Updated Task "A"' };
		attributeActivity(person as never, null);
		expect(person.actorType).toBe(ActorTypeEnum.User);
		const document = { entity: BaseEntityEnum.Document, actorType: ActorTypeEnum.User, description: 'x' };
		attributeActivity(document as never, marker);
		expect(document.description).toBe('x');
		expect(attributedDescription('', marker)).toBe('by automation "Close parents"');
	});
});
