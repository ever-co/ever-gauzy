import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The instance identity holds a private key and must never talk to the outside: no HTTP client, no
 * `fetch`, no socket. This reads every source file of the package (specs excluded).
 */
const FORBIDDEN: Array<[string, RegExp]> = [
	['@nestjs/axios', /from\s+['"]@nestjs\/axios['"]|require\(\s*['"]@nestjs\/axios['"]\s*\)/],
	['axios', /from\s+['"]axios['"]|require\(\s*['"]axios['"]\s*\)/],
	['undici', /from\s+['"]undici['"]|require\(\s*['"]undici['"]\s*\)/],
	['fetch(', /\bfetch\s*\(/],
	['node:http(s)/net/tls/dgram', /from\s+['"](node:)?(https?|net|tls|dgram|http2)['"]/]
];

export function sourceFiles(root: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(root)) {
		const path = join(root, entry);
		if (statSync(path).isDirectory()) {
			out.push(...sourceFiles(path));
		} else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) {
			out.push(path);
		}
	}
	return out;
}

export function violations(files: Array<{ path: string; text: string }>): string[] {
	return files.flatMap(({ path, text }) => FORBIDDEN.filter(([, re]) => re.test(text)).map(([name]) => `${path}: ${name}`));
}

describe('ever-instance makes no outbound request', () => {
	it('has no HTTP client, fetch or socket in its sources', () => {
		const files = sourceFiles(join(__dirname, '..')).map((path) => ({ path, text: readFileSync(path, 'utf8') }));
		expect(files.length).toBeGreaterThan(5);
		expect(violations(files)).toEqual([]);
	});

	it('would catch a planted call (control)', () => {
		expect(violations([{ path: 'planted.ts', text: "const r = await fetch('https://example.test');" }])).toHaveLength(1);
		expect(violations([{ path: 'planted.ts', text: "import { HttpService } from '@nestjs/axios';" }])).toHaveLength(1);
		expect(violations([{ path: 'planted.ts', text: "import * as https from 'node:https';" }])).toHaveLength(1);
	});
});
