import { isoOf, resumeCursorOf } from './jira-sync.service';

/**
 * An import reads the pages oldest change first, so where it stopped is a position the next one can continue from: a
 * run is resumable, not all-or-nothing.
 */
describe('where an import continues', () => {
	const base = { runCursor: '2026-11-11T11:59:00.000Z', since: '2026-11-10T00:00:00.000Z', firstFailedUpdated: null, lastAppliedUpdated: null };

	it('continues from the run’s start (less a margin) once every page was read and every issue applied', () => {
		expect(resumeCursorOf({ ...base, complete: true, lastAppliedUpdated: '2026-11-11T11:00:00.000Z' })).toBe('2026-11-11T11:59:00.000Z');
	});

	it('reads a failed issue again: the next import starts at its change, everything before it is in', () => {
		expect(resumeCursorOf({ ...base, complete: true, firstFailedUpdated: '2026-11-10T08:00:00.000Z', lastAppliedUpdated: '2026-11-11T11:00:00.000Z' })).toBe('2026-11-10T08:00:00.000Z');
	});

	it('continues from the last issue applied when the run stopped early (the cap, or an error of the API)', () => {
		expect(resumeCursorOf({ ...base, complete: false, lastAppliedUpdated: '2026-11-10T20:00:00.000Z' })).toBe('2026-11-10T20:00:00.000Z');
	});

	it('keeps its position when it applied nothing, and a full import that applied nothing has none', () => {
		expect(resumeCursorOf({ ...base, complete: false })).toBe('2026-11-10T00:00:00.000Z');
		expect(resumeCursorOf({ ...base, since: null, complete: false })).toBeNull();
	});

	it('reads the instants Jira writes, with its four-digit offsets', () => {
		expect(isoOf('2026-11-11T10:00:00.000+0000')).toBe('2026-11-11T10:00:00.000Z');
		expect(isoOf('2026-11-11T12:30:00.000+0230')).toBe('2026-11-11T10:00:00.000Z');
		expect(isoOf('2026-11-11T10:00:00.000Z')).toBe('2026-11-11T10:00:00.000Z');
		expect(isoOf('soon')).toBeNull();
		expect(isoOf(null)).toBeNull();
	});
});
