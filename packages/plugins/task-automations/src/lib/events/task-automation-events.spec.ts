/**
 * The capture (activity fact → outbox), the consumer (outbox → engine) and the attribution of activity rows, with
 * `@gauzy/core` doubled at the module boundary (its barrel boots the whole application).
 */
const mockUser: { current: Record<string, unknown> | null } = { current: null };

jest.mock('@gauzy/core', () => {
	class ActivityLogEvent {
		constructor(public readonly input: unknown) {}
	}
	class BaseEntityEventSubscriber {}
	return {
		ActivityLogEvent,
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

import 'reflect-metadata';
import { ActionTypeEnum, ActorTypeEnum, BaseEntityEnum, TASK_AUTOMATION_EVENT_NAMES, TaskAutomationTriggerEnum } from '@gauzy/contracts';
import { ActivityLogEvent } from '@gauzy/core';
import { TaskAutomationChangeCapture } from './task-automation-change.capture';
import { parseLinkClosedEvent, TaskAutomationEventConsumer } from './task-automation-event.consumer';
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
