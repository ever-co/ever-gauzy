import {
	buildQuotaState,
	isQuotaExceeded,
	normalizeQuotaBytes,
	remainingQuotaBytes,
	resolveQuotaBytes
} from './quota.calculator';

const MB = 1024 * 1024;

describe('organization storage quota calculator (spec 08 §5.7)', () => {
	describe('normalizeQuotaBytes', () => {
		it.each([
			[undefined, 0],
			[null, 0],
			['', 0],
			['0', 0],
			[0, 0],
			[-1, 0],
			['-500', 0],
			['not-a-number', 0],
			['1048576', 1048576],
			[1048576, 1048576],
			['1048576.9', 1048576] // parseInt semantics — no accidental rounding up
		])('normalizes %p to %p bytes', (raw, expected) => {
			expect(normalizeQuotaBytes(raw as any)).toBe(expected);
		});
	});

	describe('resolveQuotaBytes — org override beats the deployment default', () => {
		it('uses the env default when no override is stored', () => {
			expect(resolveQuotaBytes(undefined, 100 * MB)).toBe(100 * MB);
			expect(resolveQuotaBytes(null, 100 * MB)).toBe(100 * MB);
			expect(resolveQuotaBytes('', 100 * MB)).toBe(100 * MB);
		});

		it('uses the org override when one is stored', () => {
			expect(resolveQuotaBytes(String(5 * MB), 100 * MB)).toBe(5 * MB);
		});

		it('treats an explicit "0" override as UNLIMITED for that organization', () => {
			// The whole point of the override: opting one organization out of a fleet-wide cap.
			expect(resolveQuotaBytes('0', 100 * MB)).toBe(0);
		});

		it('falls back to unlimited when neither side is usable', () => {
			expect(resolveQuotaBytes(undefined, undefined)).toBe(0);
			expect(resolveQuotaBytes('garbage', 0)).toBe(0);
		});
	});

	describe('remainingQuotaBytes', () => {
		it('returns null when unlimited', () => {
			expect(remainingQuotaBytes(50 * MB, 0)).toBeNull();
		});

		it('returns the headroom under a quota', () => {
			expect(remainingQuotaBytes(40 * MB, 100 * MB)).toBe(60 * MB);
		});

		it('clamps at zero for an already-over-quota organization (never negative)', () => {
			expect(remainingQuotaBytes(140 * MB, 100 * MB)).toBe(0);
		});
	});

	describe('isQuotaExceeded', () => {
		it('never exceeds when the quota is unlimited', () => {
			expect(isQuotaExceeded(500 * MB, 500 * MB, 0)).toBe(false);
		});

		it('accepts a write that exactly fills the quota', () => {
			expect(isQuotaExceeded(90 * MB, 10 * MB, 100 * MB)).toBe(false);
		});

		it('rejects the byte that goes over', () => {
			expect(isQuotaExceeded(90 * MB, 10 * MB + 1, 100 * MB)).toBe(true);
		});

		it('rejects any non-zero write for an already-over-quota organization', () => {
			expect(isQuotaExceeded(120 * MB, 1, 100 * MB)).toBe(true);
		});

		it('never blocks a zero-byte write, even over quota', () => {
			expect(isQuotaExceeded(120 * MB, 0, 100 * MB)).toBe(false);
		});

		it('treats a negative usage reading as zero rather than granting free space', () => {
			expect(isQuotaExceeded(-50 * MB, 101 * MB, 100 * MB)).toBe(true);
		});
	});

	describe('buildQuotaState — the settings response block', () => {
		it('reports an unlimited organization', () => {
			expect(buildQuotaState(12345, 0)).toEqual({
				quotaBytes: 0,
				usedBytes: 12345,
				remainingBytes: null,
				unlimited: true
			});
		});

		it('reports a capped organization', () => {
			expect(buildQuotaState(40 * MB, 100 * MB)).toEqual({
				quotaBytes: 100 * MB,
				usedBytes: 40 * MB,
				remainingBytes: 60 * MB,
				unlimited: false
			});
		});

		it('never reports negative usage', () => {
			expect(buildQuotaState(-1, 100 * MB).usedBytes).toBe(0);
		});
	});
});
