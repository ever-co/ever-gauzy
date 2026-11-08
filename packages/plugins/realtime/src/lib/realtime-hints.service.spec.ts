import { coalesceKey, commentHint, documentHint, mentionHint, notificationHint, taskHint } from './realtime-hints.service';

describe('realtime hints', () => {
	it('builds an organization-wide task hint with the project for a board', () => {
		const hint = taskHint({ id: 't1', tenantId: 'ten', organizationId: 'org', projectId: 'p1' }, 'updated', 'u1');
		expect(hint).toEqual({
			name: 'task.updated',
			aggregateType: 'task',
			aggregateId: 't1',
			tenantId: 'ten',
			organizationId: 'org',
			hint: { entity: 'Task', entityId: 't1', action: 'updated', organizationId: 'org', projectId: 'p1', actorUserId: 'u1' }
		});
	});

	it('produces nothing for a fact without an identity, a tenant or (organization-wide) an organization', () => {
		expect(taskHint({ id: '', tenantId: 'ten', organizationId: 'org' }, 'created', null)).toBeNull();
		expect(taskHint({ id: 't1', organizationId: 'org' }, 'created', null)).toBeNull();
		// A partial save result without its organization must not become a tenant-wide hint.
		expect(taskHint({ id: 't1', tenantId: 'ten' }, 'updated', null)).toBeNull();
		expect(documentHint({ id: 'd1', tenantId: 'ten' }, 'updated', null)).toBeNull();
		expect(mentionHint({ entityId: 'c1', tenantId: 'ten' } as never, null, null)).toBeNull();
	});

	it('names the record whose comments changed, never the text', () => {
		const hint = commentHint({
			type: 'created',
			comment: { id: 'c1', entity: 'Task', entityId: 't1', parentId: null, tenantId: 'ten', organizationId: 'org' },
			actorUserId: 'u1'
		} as never);
		expect(hint?.name).toBe('comment.created');
		expect(hint?.hint).toEqual({
			entity: 'Comment',
			entityId: 'c1',
			action: 'created',
			organizationId: 'org',
			parent: { entity: 'Task', entityId: 't1' },
			parentCommentId: null,
			actorUserId: 'u1'
		});
		expect(JSON.stringify(hint)).not.toContain('comment text');
	});

	it('addresses a mention and a notification to the recipient user only', () => {
		const mention = mentionHint(
			{ entity: 'Comment', entityId: 'c1', parentEntityType: 'Task', parentEntityId: 't1', mentionedEmployeeId: 'e2', tenantId: 'ten', organizationId: 'org' } as never,
			'u2',
			'u1'
		);
		expect(mention?.hint.recipientUserIds).toEqual(['u2']);
		expect(mention?.hint.parent).toEqual({ entity: 'Task', entityId: 't1' });

		const notification = notificationHint(
			{ id: 'n1', entity: 'Task', entityId: 't1', type: 'Assignment', receiverEmployeeId: 'e2', tenantId: 'ten', organizationId: 'org' } as never,
			'u2',
			'u1'
		);
		expect(notification?.name).toBe('employee_notification.created');
		expect(notification?.aggregateId).toBe('n1');
		expect(notification?.hint.recipientUserIds).toEqual(['u2']);
		expect(notificationHint({ entity: 'Task', entityId: 't1', tenantId: 'ten' } as never, 'u2', null)).toBeNull();
	});

	it('maps every document fact to document.updated with the action inside', () => {
		expect(documentHint({ id: 'd1', tenantId: 'ten', organizationId: 'org' }, 'created', null)).toMatchObject({
			name: 'document.updated',
			hint: { entity: 'Document', entityId: 'd1', action: 'created' }
		});
	});

	it('keys coalescing by tenant, name and aggregate', () => {
		expect(coalesceKey({ tenantId: 'ten', name: 'task.updated', aggregateId: 't1' })).toBe('ten|task.updated|t1');
	});
});
