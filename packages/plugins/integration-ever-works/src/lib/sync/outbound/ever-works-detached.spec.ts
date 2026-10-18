import 'reflect-metadata';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Subject } from 'rxjs';
import { runDetached } from './ever-works-detached';
import { EverWorksTaskEventListener } from './ever-works-task-event.listener';
import {
	EVER_WORKS_COMMENT_SIGNALS,
	EVER_WORKS_TASK_SIGNALS,
	EverWorksTaskEdgeCapture
} from '../../tasks/ever-works-task.signals';
import { EVER_WORKS_TEAM_SIGNALS, EverWorksTeamCapture } from '../../teams/ever-works-team.signals';

/**
 * The capture drains run outside the context of the write that signalled them (local e2e, 2026-10-18): on SQLite the
 * embedded transaction queue of `@gauzy/core` tracks which code owns the connection in an `AsyncLocalStorage`, and a
 * fire-and-forget enqueue that kept the committed write's ownership wedged the API. The stand-in here is any
 * `AsyncLocalStorage` set around the write: the work a drain starts must not see it.
 */
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	return {
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		ExportRedacted: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		TenantOrganizationBaseEntity: class {},
		TenantBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		BaseEntityEventSubscriber: class {},
		BaseEntityEventTypeEnum: { CREATED: 'created', UPDATED: 'updated', DELETED: 'deleted' },
		TaskEvent: class {},
		EventBus: class {},
		Comment: class {},
		EntitySubscription: class {},
		TaskLinkedIssue: class {},
		OrganizationTeam: class {},
		OrganizationTeamEmployee: class {},
		IntegrationTenant: class {},
		RequestContext: { currentTenantId: () => 't1', currentUserId: () => 'u1', currentOrganizationId: () => null }
	};
});

const write = new AsyncLocalStorage<string>();
const flush = () => new Promise((resolve) => setImmediate(resolve));

/** An outbound queue that records the write context each enqueue ran in. */
function recordingQueue() {
	const seen: Array<string | undefined> = [];
	const queue = {
		enqueue: jest.fn(async () => {
			seen.push(write.getStore());
			await Promise.resolve();
			seen.push(write.getStore());
			return true;
		})
	};
	return { queue, seen };
}

describe('runDetached', () => {
	it('runs the work, and the work it starts, outside the caller context', async () => {
		const seen: Array<string | undefined> = [];
		await write.run('write-transaction', async () => {
			expect(write.getStore()).toBe('write-transaction');
			await runDetached(async () => {
				seen.push(write.getStore());
				await new Promise((resolve) => setTimeout(resolve, 1));
				seen.push(write.getStore());
			});
			expect(write.getStore()).toBe('write-transaction');
		});
		expect(seen).toEqual([undefined, undefined]);
	});

	it('returns what the work returns', () => {
		expect(runDetached(() => 42)).toBe(42);
	});
});

describe('the capture drains enqueue outside the signalling write', () => {
	it('task edge and comment signals', async () => {
		const { queue, seen } = recordingQueue();
		const capture = new EverWorksTaskEdgeCapture(queue as never, {} as never);
		capture.onModuleInit();
		try {
			write.run('write-transaction', () => {
				EVER_WORKS_TASK_SIGNALS.next({
					tenantId: 't1',
					organizationId: 'o1',
					taskId: 'task-1',
					actorUserId: 'u1'
				} as never);
				EVER_WORKS_COMMENT_SIGNALS.next({
					tenantId: 't1',
					organizationId: 'o1',
					entity: 'Task',
					commentId: 'c-1',
					deleted: false,
					actorUserId: 'u1'
				} as never);
			});
			await flush();
			expect(queue.enqueue).toHaveBeenCalledTimes(2);
			expect(seen).toEqual([undefined, undefined, undefined, undefined]);
		} finally {
			capture.onModuleDestroy();
		}
	});

	it('team signals', async () => {
		const { queue, seen } = recordingQueue();
		const capture = new EverWorksTeamCapture(queue as never);
		capture.onModuleInit();
		try {
			write.run('write-transaction', () =>
				EVER_WORKS_TEAM_SIGNALS.next({
					tenantId: 't1',
					organizationId: 'o1',
					teamId: 'team-1',
					deleted: false,
					actorUserId: 'u1'
				} as never)
			);
			await flush();
			expect(queue.enqueue).toHaveBeenCalledTimes(1);
			expect(seen).toEqual([undefined, undefined]);
		} finally {
			capture.onModuleDestroy();
		}
	});

	it('task events (the context reads stay in the write: tenant and actor)', async () => {
		const { queue, seen } = recordingQueue();
		const events = new Subject<unknown>();
		const eventBus = { ofType: () => events };
		const listener = new EverWorksTaskEventListener(eventBus as never, queue as never);
		listener.onModuleInit();
		try {
			write.run('write-transaction', () =>
				events.next({ entity: { id: 'task-1', tenantId: 't1', organizationId: 'o1' }, type: 'updated' })
			);
			await flush();
			expect(queue.enqueue).toHaveBeenCalledWith(
				expect.objectContaining({ gauzyId: 'task-1', actorUserId: 'u1' })
			);
			expect(seen).toEqual([undefined, undefined]);
		} finally {
			listener.onModuleDestroy();
		}
	});
});
