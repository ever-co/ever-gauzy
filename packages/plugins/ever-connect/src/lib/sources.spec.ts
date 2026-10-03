import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Two rules on the plugin's own sources (specs and the vendored SDK excluded):
 *
 * - the install source is declared, never guessed: no source reads a payment key, the demo switch,
 *   a cloud provider variable, the container path, the desktop switch or the hostname;
 * - every request goes through the SDK's client: no other HTTP client, no `fetch(` and no socket
 *   module in the plugin's own code.
 */
const INFERENCES = [
	'STRIPE_SECRET_KEY',
	'process.env.DEMO',
	"process.env['DEMO']",
	'CLOUD_PROVIDER',
	'/srv/gauzy',
	'IS_ELECTRON',
	'GAUZY_CLOUD_ENDPOINT',
	'os.hostname',
	'hostname()'
];

const CLIENTS: Array<[string, RegExp]> = [
	['@nestjs/axios', /from\s+['"]@nestjs\/axios['"]/],
	['axios', /from\s+['"]axios['"]/],
	['undici', /from\s+['"]undici['"]/],
	['fetch(', /\bfetch\s*\(/],
	['node:http(s)/net/tls/dgram', /from\s+['"](node:)?(https?|net|tls|dgram|http2)['"]/]
];

export function sources(root: string): Array<{ path: string; text: string }> {
	const out: Array<{ path: string; text: string }> = [];
	for (const entry of readdirSync(root)) {
		const path = join(root, entry);
		if (statSync(path).isDirectory()) {
			if (entry !== 'vendor' && entry !== 'fixtures') out.push(...sources(path));
		} else if (/\.(ts|html)$/.test(entry) && !/\.spec\.ts$/.test(entry)) {
			out.push({ path, text: readFileSync(path, 'utf8') });
		}
	}
	return out;
}

export function inferences(files: Array<{ path: string; text: string }>): string[] {
	return files.flatMap(({ path, text }) =>
		INFERENCES.filter((needle) => text.includes(needle)).map((needle) => `${path}: ${needle}`)
	);
}

export function clients(files: Array<{ path: string; text: string }>): string[] {
	return files.flatMap(({ path, text }) =>
		CLIENTS.filter(([, re]) => re.test(text)).map(([name]) => `${path}: ${name}`)
	);
}

describe('ever-connect sources', () => {
	const roots = ['ever-connect', 'ever-connect-ui'].map((name) => join(__dirname, '../../..', name, 'src'));
	const files = roots.flatMap((root) => {
		try {
			return sources(root);
		} catch {
			return [];
		}
	});

	it('never infer the install source', () => {
		expect(files.length).toBeGreaterThan(20);
		expect(inferences(files)).toEqual([]);
	});

	it('call Ever Platform only through the SDK client (the API plugin)', () => {
		const api = files.filter(({ path }) => path.includes(join('plugins', 'ever-connect', 'src')));
		expect(clients(api)).toEqual([]);
	});

	it('would catch a planted read or call (control)', () => {
		expect(
			inferences([{ path: 'planted.ts', text: "const cloud = !!process.env['STRIPE_SECRET_KEY'];" }])
		).toHaveLength(1);
		expect(clients([{ path: 'planted.ts', text: "await fetch('https://api.ever.co/v1/x');" }])).toHaveLength(1);
		expect(clients([{ path: 'planted.ts', text: "import { HttpService } from '@nestjs/axios';" }])).toHaveLength(1);
	});
});
