import { CHAT_EVENT_NAMES, CHAT_STREAMED_EVENTS } from '@gauzy/contracts';
import { collaborationEventNames, collaborationReplayNames, resolveRealtimeSelection, toRealtimeEnvelope, withoutRecipients } from './realtime-envelope';

describe('resolveRealtimeSelection', () => {
	it('resolves exact names and one-segment prefixes within the collaboration catalogue', () => {
		expect(resolveRealtimeSelection(['task.updated'])).toEqual(['task.updated']);
		expect(resolveRealtimeSelection(['task.*'])).toEqual(['task.created', 'task.deleted', 'task.updated']);
		expect(resolveRealtimeSelection(['comment.*', 'presence.changed'])).toEqual([
			'comment.created',
			'comment.deleted',
			'comment.updated',
			'presence.changed'
		]);
	});

	it('refuses names outside the catalogue by matching nothing', () => {
		expect(resolveRealtimeSelection(['order.*'])).toEqual([]);
		expect(resolveRealtimeSelection(['inbox_item.created'])).toEqual([]);
		expect(resolveRealtimeSelection(['', 'nonsense'])).toEqual([]);
	});

	it('covers everything with "*"', () => {
		expect(resolveRealtimeSelection(['*']).length).toBe(11);
	});

	it('offers every name the chat plugin declares, the member state (unread badges) included', () => {
		const offered = collaborationEventNames(CHAT_STREAMED_EVENTS);
		for (const name of CHAT_STREAMED_EVENTS) {
			expect(offered).toContain(name);
		}
		expect(resolveRealtimeSelection([CHAT_EVENT_NAMES.MEMBER_STATE_CHANGED], offered)).toEqual(['chat_member.state_changed']);
		expect(resolveRealtimeSelection(['chat_member.*'], offered)).toEqual(['chat_member.state_changed']);
		expect(collaborationReplayNames(CHAT_STREAMED_EVENTS)).toEqual(expect.arrayContaining([...CHAT_STREAMED_EVENTS]));
	});

	it('offers the chat and inbox names other plugins declared, and nothing of another family', () => {
		const declared = ['chat_message.created', 'chat_member.state_changed', 'inbox_item.created', 'order.created', 'presence.changed'];
		const offered = collaborationEventNames(declared);
		expect(offered).toContain('chat_message.created');
		expect(offered).toContain('inbox_item.created');
		expect(offered).not.toContain('order.created');
		expect(offered.length).toBe(11 + 3);
		expect(resolveRealtimeSelection(['chat_message.*', 'inbox_item.*'], offered)).toEqual(['chat_message.created', 'inbox_item.created']);
		expect(resolveRealtimeSelection(['order.*'], offered)).toEqual([]);
		// The catch-up replays the durable ones only.
		const replayed = collaborationReplayNames(declared);
		expect(replayed).toContain('chat_message.created');
		expect(replayed).not.toContain('presence.changed');
		expect(replayed).not.toContain('typing.signalled');
	});
});

describe('toRealtimeEnvelope', () => {
	const base = {
		name: 'task.updated',
		eventId: 'e1',
		tenantId: 't1',
		occurredAt: '2026-11-07T00:00:00.000Z',
		aggregate: { type: 'task', id: 'a1' },
		sequence: 7,
		data: { entity: 'Task', entityId: 'a1', action: 'updated', recipientUserIds: ['u1'] }
	};

	it('maps a hub envelope to the schema envelope without the recipient list', () => {
		expect(toRealtimeEnvelope(base as never)).toEqual({
			eventId: 'e1',
			eventName: 'task.updated',
			occurredAt: '2026-11-07T00:00:00.000Z',
			aggregate: { type: 'task', id: 'a1' },
			sequence: 7,
			data: { entity: 'Task', entityId: 'a1', action: 'updated' }
		});
	});

	it('serves a sequence the schema Int cannot carry as null, never truncated', () => {
		expect(toRealtimeEnvelope({ ...base, sequence: 2 ** 40 } as never)?.sequence).toBeNull();
		expect(toRealtimeEnvelope({ ...base, sequence: undefined } as never)?.sequence).toBeNull();
	});

	it('withholds an envelope without an identity or an aggregate', () => {
		expect(toRealtimeEnvelope(undefined)).toBeUndefined();
		expect(toRealtimeEnvelope({ ...base, eventId: '' } as never)).toBeUndefined();
		expect(toRealtimeEnvelope({ ...base, aggregate: undefined } as never)).toBeUndefined();
	});
});

describe('withoutRecipients', () => {
	it('leaves non-objects alone', () => {
		expect(withoutRecipients(null)).toBeNull();
		expect(withoutRecipients([1])).toEqual([1]);
		expect(withoutRecipients('x')).toBe('x');
	});
});
