import { admitsRow, CatchUpRow, selectCatchUp } from './realtime-catch-up.service';

function row(partial: Partial<CatchUpRow> & { eventId: string; at: number }): CatchUpRow {
	return {
		eventId: partial.eventId,
		eventName: partial.eventName ?? 'task.updated',
		aggregateType: partial.aggregateType ?? 'task',
		aggregateId: partial.aggregateId ?? 'a1',
		availableAt: new Date(partial.at),
		sequence: partial.sequence ?? 1,
		payload: partial.payload ?? { entity: 'Task', entityId: 'a1', action: 'updated' }
	} as CatchUpRow;
}

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

describe('selectCatchUp', () => {
	const rows = [
		row({ eventId: 'e1', at: 1000 }),
		row({ eventId: 'e2', at: 2000, payload: { recipientUserIds: ['u2'] } }),
		row({ eventId: 'e3', at: 3000 }),
		row({ eventId: 'e4', at: 3000 }),
		row({ eventId: 'e5', at: 4000 })
	];

	it('answers everything since the cursor, oldest first, the cursor time included', () => {
		const answer = selectCatchUp(rows, 'u1', { after: 3000 });
		expect(answer.events.map((e) => e.eventId)).toEqual(['e3', 'e4', 'e5']);
		expect(answer.cursor).toBe(4000);
		expect(answer.resync).toBe(false);
	});

	it('withholds addressed rows from a non-recipient and strips the recipient list for a recipient', () => {
		expect(selectCatchUp(rows, 'u1', { after: 0 }).events.map((e) => e.eventId)).not.toContain('e2');
		const forRecipient = selectCatchUp(rows, 'u2', { after: 2000, limit: 1 });
		expect(forRecipient.events[0].eventId).toBe('e2');
		expect(forRecipient.events[0].data).toEqual({});
	});

	it('answers the newest events when there is no cursor', () => {
		const answer = selectCatchUp(rows, 'u1', { limit: 2 });
		expect(answer.events.map((e) => e.eventId)).toEqual(['e4', 'e5']);
		expect(answer.cursor).toBe(4000);
	});

	it('asks for a resync when the cursor is older than everything retained', () => {
		const answer = selectCatchUp(rows, 'u1', { after: 500 });
		expect(answer.resync).toBe(true);
		expect(answer.events.length).toBe(4);
	});

	it('bounds the limit and keeps the cursor when nothing is new', () => {
		expect(selectCatchUp(rows, 'u1', { after: 1000, limit: 10_000 }).events.length).toBe(4);
		const quiet = selectCatchUp(rows, 'u1', { after: 9000 });
		expect(quiet.events).toEqual([]);
		expect(quiet.cursor).toBe(9000);
	});

	it('answers an empty outbox honestly', () => {
		expect(selectCatchUp([], 'u1', { after: 1 })).toEqual({ events: [], cursor: 1, resync: false });
		expect(selectCatchUp([], 'u1', {})).toEqual({ events: [], cursor: null, resync: false });
	});
});
