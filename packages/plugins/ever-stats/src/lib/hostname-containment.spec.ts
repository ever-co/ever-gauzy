import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

/**
 * The Ever Platform host and the variable that points the statistics at it appear only in the
 * statistics packages, the environment sample, documentation and the egress audit's inputs (which
 * point a module loaded by mistake at a sealed test address): no other code of Gauzy can reach the
 * statistics endpoint.
 */
const ALLOWED = [
	/^packages\/plugins\/ever-stats(-ui)?\//,
	/^packages\/plugins\/ever-instance\//,
	// The Ever Platform connection, which has its own address setting (`EVER_PLATFORM_API_URL`).
	/^packages\/plugins\/ever-connect(-ui)?\//,
	/^tools\/egress-audit\//,
	/^\.env\.sample$/,
	/(^|\/)README\.md$/,
	/\.md$/
];

export function outside(paths: string[]): string[] {
	return paths.filter((path) => !ALLOWED.some((re) => re.test(path)));
}

function tracked(pattern: string): string[] {
	const root = join(__dirname, '../../../../..');
	try {
		return execFileSync('git', ['grep', '-l', '-E', pattern, '--', '.'], { cwd: root, encoding: 'utf8' })
			.split('\n')
			.map((line) => line.trim().replace(/\\/g, '/'))
			.filter(Boolean);
	} catch (error) {
		// `git grep` exits with 1 when nothing matches.
		if ((error as { status?: number }).status === 1) return [];
		throw error;
	}
}

describe('the statistics endpoint is reachable only from the statistics module', () => {
	it.each([['api\\.ever\\.co([^a-z.-]|$)'], ['EVER_STATS_API_URL']])('%s appears nowhere else', (pattern) => {
		expect(outside(tracked(pattern))).toEqual([]);
	});

	it('would catch a planted use (control)', () => {
		expect(outside(['packages/core/src/lib/stats/stats.service.ts'])).toEqual(['packages/core/src/lib/stats/stats.service.ts']);
		expect(outside(['tools/egress-audit/adapter.mjs', 'tools/other/x.mjs'])).toEqual(['tools/other/x.mjs']);
	});
});
