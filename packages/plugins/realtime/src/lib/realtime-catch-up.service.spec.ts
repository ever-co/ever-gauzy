import { admitsRow, afterCursor, CatchUpRow, selectCatchUp } from './realtime-catch-up.service';

function row(partial: Partial<CatchUpRow> & { eventId: string; at: number }): CatchUpRow {
	return {
		eventId: partial.eventId,
		eventName: partial.eventName ?? 'task.updated',
		aggregateType: partial.aggregateType ?? 'task',
		aggregateId: partial.aggregateId ?? 'a1',
		createdAt: new Date(partial.at),
		sequence: partial.sequence ?? 1,
		payload: partial.payload ?? { entity: 'Task', entityId: 'a1', action: 'updated' }
	} as CatchUpRow;
}

const ok = { truncated: false, resync: false };

describe('admitsRow', () => {
	it('admits an organization-wide row to anyone of the scope', () => {
		expect(admitsRow(row({ eventId: 'e', at: 1 }), 'u1')).toBe(true);
		expect(admitsRow(row({ eventId: 'e', at: 1 }), null)).toBe(true);
	});

	it('admits an addressed row to its recipients only', () => {
		const addressed = row({ eventId: 'e', at: 1, payload: { recipientUserIds: ['u1'] } });
		expect(admitsRow(addressed, 'u1')).toBe(true);
		expect(admitsRow(addressed, 'u2')).toBe(false);
		expect(admitsRow(addressed, null)).toBe(false);
	});
});

describe('afterCursor', () => {
	it('is inclusive at the cursor time without an id, and exact with one', () => {
		const same = row({ eventId: 'b', at: 1000 });
		expect(afterCursor(same, 1000, null)).toBe(true);
		expect(afterCursor(same, 1000, 'a')).toBe(true);
		expect(afterCursor(same, 1000, 'b')).toBe(false);
		expect(afterCursor(same, 1000, 'c')).toBe(false);
		expect(afterCursor(same, 999, 'z')).toBe(true);
		expect(afterCursor(same, 1001, null)).toBe(false);
	});
});

describe('selectCatchUp', () => {
	const rows = [
		row({ eventId: 'e1', at: 1000 }),
		row({ eventId: 'e2', at: 2000, payload: { recipientUserIds: ['u2'] } }),
		row({ eventId: 'e3', at: 3000 }),
		row({ eventId: 'e4', at: 3000 }),
		row({ eventId: 'e5', at: 4000 })
	];

	it('answers everything after the cursor, oldest first, with an exact cursor to continue from', () => {
		const answer = selectCatchUp(rows, 'u1', { after: 3000 }, ok);
		expect(answer.events.map((e) => e.eventId)).toEqual(['e3', 'e4', 'e5']);
		expect(answer.cursor).toBe(4000);
		expect(answer.cursorId).toBe('e5');
		expect(answer.hasMore).toBe(false);
		expect(answer.resync).toBe(false);
	});

	it('walks a same-millisecond group page by page without repeating or skipping', () => {
		const first = selectCatchUp(rows, 'u1', { after: 1000, afterId: 'e1', limit: 1 }, ok);
		expect(first.events.map((e) => e.eventId)).toEqual(['e3']);
		expect(first.hasMore).toBe(true);
		const second = selectCatchUp(rows, 'u1', { after: first.cursor ?? 0, afterId: first.cursorId ?? undefined, limit: 1 }, ok);
		expect(second.events.map((e) => e.eventId)).toEqual(['e4']);
		const third = selectCatchUp(rows, 'u1', { after: second.cursor ?? 0, afterId: second.cursorId ?? undefined, limit: 1 }, ok);
		expect(third.events.map((e) => e.eventId)).toEqual(['e5']);
		expect(third.hasMore).toBe(false);
	});

	it('withholds addressed rows from a non-recipient and strips the recipient list for a recipient', () => {
		expect(selectCatchUp(rows, 'u1', { after: 0 }, ok).events.map((e) => e.eventId)).not.toContain('e2');
		const forRecipient = selectCatchUp(rows, 'u2', { after: 2000, limit: 1 }, ok);
		expect(forRecipient.events[0].eventId).toBe('e2');
		expect(forRecipient.events[0].data).toEqual({});
	});

	it('starts a client without a cursor from now, with nothing to apply', () => {
		const answer = selectCatchUp(rows, 'u1', { limit: 2 }, ok);
		expect(answer.events).toEqual([]);
		expect(answer.cursorId).toBeNull();
		expect(typeof answer.cursor).toBe('number');
	});

	it('reports a resync and a truncated read as the caller stated them', () => {
		const answer = selectCatchUp(rows, 'u1', { after: 1000, limit: 4 }, { truncated: true, resync: true });
		expect(answer.resync).toBe(true);
		expect(answer.hasMore).toBe(true);
	});

	it('keeps the cursor when nothing is new', () => {
		const quiet = selectCatchUp(rows, 'u1', { after: 9000, afterId: 'zz' }, ok);
		expect(quiet.events).toEqual([]);
		expect(quiet.cursor).toBe(9000);
		expect(quiet.cursorId).toBe('zz');
	});
});
