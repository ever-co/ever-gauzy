// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { DatabaseTypeEnum } from '@gauzy/config';
import { overlapCondition } from './get-conflict-time-log.handler';

/**
 * A new time log conflicts with every existing log it overlaps. Only PostgreSQL tested a real overlap:
 * SQLite missed an existing log inside or around the new range, MySQL one overlapping either of its ends.
 */
describe('overlapCondition', () => {
	const start = '2026-10-12T10:00:00.000Z';
	const stop = '2026-10-12T11:00:00.000Z';

	it.each([DatabaseTypeEnum.sqlite, DatabaseTypeEnum.betterSqlite3])('uses a full overlap test on %s', (db) => {
		expect(overlapCondition(db, 'time_log', start, stop)).toBe(
			`"time_log"."startedAt" < '${stop}' AND "time_log"."stoppedAt" > '${start}'`
		);
	});

	it('keeps OVERLAPS on PostgreSQL', () => {
		expect(overlapCondition(DatabaseTypeEnum.postgres, 'time_log', start, stop)).toContain('OVERLAPS');
	});

	it('rejects an unsupported database', () => {
		expect(() => overlapCondition('oracle' as DatabaseTypeEnum, 'time_log', start, stop)).toThrow();
	});
});
