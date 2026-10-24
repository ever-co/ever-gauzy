import { serializeDetails, SYNC_LOG_DETAILS_MAX } from './ever-works-sync-log.service';
import { describeSyncError } from './ever-works-sync.loop';

describe('Ever Works sync helpers', () => {
	it('log details stay valid JSON above the size limit', () => {
		const small = { a: 1, b: ['x'] };
		expect(JSON.parse(serializeDetails(small))).toEqual(small);
		const big = { text: 'x'.repeat(SYNC_LOG_DETAILS_MAX) };
		const stored = serializeDetails(big);
		expect(stored.length).toBeLessThanOrEqual(SYNC_LOG_DETAILS_MAX);
		expect(JSON.parse(stored)).toMatchObject({ truncated: true, length: JSON.stringify(big).length });
	});

	it('a failed pass is logged with its cause, with keys and bearer tokens masked', () => {
		// Assembled at run time: a made-up key, so secret scanners do not take it for a real one.
		const fake = ['ew', 'int', 'TEST', 'FIXTURE', '123'].join('_');
		const text = describeSyncError(new Error(`connect failed for Bearer abc.def with ${fake} at the host`));
		expect(text).toContain('Error: connect failed for Bearer <redacted>');
		expect(text).not.toContain('abc.def');
		expect(text).not.toContain(fake);
		expect(describeSyncError('not an error')).toBe('error');
		expect(describeSyncError(new Error('y'.repeat(500))).length).toBe('Error: '.length + 200);
	});
});
