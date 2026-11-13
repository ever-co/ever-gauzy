import { isNotificationFanOutEnabled } from './fan-out-enabled';
import { actorDisplayName, followedTaskFieldsChanged } from './follower-fan-out.service';

describe('isNotificationFanOutEnabled', () => {
	it('is off unless exactly "true", warning once for anything else', () => {
		const warn = jest.fn();
		expect(isNotificationFanOutEnabled({}, warn)).toBe(false);
		expect(isNotificationFanOutEnabled({ GAUZY_NOTIFICATION_FANOUT_ENABLED: 'false' }, warn)).toBe(false);
		expect(isNotificationFanOutEnabled({ GAUZY_NOTIFICATION_FANOUT_ENABLED: 'true' }, warn)).toBe(true);
		expect(warn).not.toHaveBeenCalled();
		expect(isNotificationFanOutEnabled({ GAUZY_NOTIFICATION_FANOUT_ENABLED: 'yes' }, warn)).toBe(false);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).not.toContain('yes');
	});
});

describe('followedTaskFieldsChanged', () => {
	it('names the followed fields an update stated, and nothing for an update without them', () => {
		expect(followedTaskFieldsChanged({ status: 'completed' } as never)).toEqual(['status']);
		expect(followedTaskFieldsChanged({ taskStatusId: 's1', title: 'x' } as never)).toEqual(['taskStatusId']);
		expect(followedTaskFieldsChanged({ title: 'renamed' } as never)).toEqual([]);
		expect(followedTaskFieldsChanged(undefined)).toEqual([]);
	});
});

describe('actorDisplayName', () => {
	it('prefers the full name, then the name, then the email', () => {
		expect(actorDisplayName({ firstName: 'Ada', lastName: 'Lovelace' })).toBe('Ada Lovelace');
		expect(actorDisplayName({ firstName: ' ', name: 'ada' })).toBe('ada');
		expect(actorDisplayName({ email: 'ada@example.com' })).toBe('ada@example.com');
		expect(actorDisplayName(null)).toBe('Someone');
	});
});

describe('FollowerFanOutService.onCommentCreated', () => {
	const { FollowerFanOutService } = jest.requireActual('./follower-fan-out.service');
	const { RequestContext } = jest.requireActual('../../core/context/request-context');
	const { CommentEvent } = jest.requireActual('../../comment/events');

	const previous = process.env.GAUZY_NOTIFICATION_FANOUT_ENABLED;
	beforeEach(() => {
		process.env.GAUZY_NOTIFICATION_FANOUT_ENABLED = 'true';
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue('employee-author');
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ firstName: 'Ada', lastName: 'Lovelace', employeeId: 'employee-author' });
	});
	afterEach(() => {
		jest.restoreAllMocks();
		process.env.GAUZY_NOTIFICATION_FANOUT_ENABLED = previous;
	});

	/** A fan-out over a record followed by the author and two others. */
	function build() {
		const subscriptions = [{ employeeId: 'employee-author' }, { employeeId: 'employee-1' }, { employeeId: 'employee-2' }];
		const dataSource = {
			getRepository: jest.fn(() => ({
				find: jest.fn(async ({ select }: { select: Record<string, boolean> }) =>
					select.employeeId ? subscriptions : subscriptions.map((row) => ({ id: row.employeeId }))
				),
				findOne: jest.fn(async () => null)
			}))
		};
		const notifications = { publishNotificationEvent: jest.fn() };
		return { service: new FollowerFanOutService(dataSource, notifications), notifications };
	}

	it('names the record and the comment, so the follower opens the thread', async () => {
		const { service, notifications } = build();
		await service.onCommentCreated(
			new CommentEvent('created', { id: 'comment-1', entity: 'Document', entityId: 'page-1', tenantId: 'tenant-1', organizationId: 'org-1' })
		);
		expect(notifications.publishNotificationEvent).toHaveBeenCalledTimes(2);
		for (const [input] of notifications.publishNotificationEvent.mock.calls) {
			expect(input).toMatchObject({ entity: 'Document', entityId: 'page-1', commentId: 'comment-1', type: 'Comment', tenantId: 'tenant-1' });
		}
		expect(notifications.publishNotificationEvent.mock.calls.map(([input]: [{ receiverEmployeeId: string }]) => input.receiverEmployeeId)).toEqual(['employee-1', 'employee-2']);
	});

	it('names no comment on a task update', async () => {
		const { service, notifications } = build();
		await service.notifyFollowers({ entity: 'Task', entityId: 'task-1', tenantId: 'tenant-1', type: 'TaskUpdate', action: 'Updated', entityName: 'A task' });
		expect(notifications.publishNotificationEvent.mock.calls[0][0]).not.toHaveProperty('commentId');
	});
});
