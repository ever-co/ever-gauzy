import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROWS } from '@ever-co/connect-contracts';

/**
 * The README's "Requests made while connected" table is the public list of what leaves an
 * installation: each request in it must be one of the SDK's outbound-call rows (`ROWS` of
 * `@ever-co/connect-contracts`), under that row's number, and the table lists exactly the rows this
 * release uses.
 */
const USED_ROWS = [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16, 31];

function tableRows(): Array<{ row: number; requests: string[] }> {
	const readme = readFileSync(join(__dirname, '../../README.md'), 'utf8');
	const rows: Array<{ row: number; requests: string[] }> = [];
	for (const line of readme.split('\n')) {
		const match = /^\|\s*(\d+)\s*\|([^|]+)\|/.exec(line);
		if (!match) continue;
		const requests = [...match[2].matchAll(/`([A-Z]+ [^`]+)`/g)].map((m) => m[1]);
		rows.push({ row: Number(match[1]), requests });
	}
	return rows;
}

describe('the README table of requests', () => {
	it('lists exactly the rows this release uses', () => {
		expect(tableRows().map((entry) => entry.row)).toEqual(USED_ROWS);
	});

	it.each(tableRows().map((entry) => [entry.row, entry.requests] as const))(
		'row %s: every request is one of the SDK row',
		(row, requests) => {
			const sdk = ROWS.find((entry) => entry.row === row);
			expect(sdk).toBeDefined();
			const endpoints = sdk!.endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`);
			expect(requests.length).toBeGreaterThan(0);
			for (const request of requests) {
				expect(endpoints).toContain(request);
			}
		}
	);
});
