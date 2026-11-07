import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Two rules on the plugin's own sources (specs and test fixtures excluded):
 *
 * - the install source is declared, never guessed: no source reads a payment key, the demo switch,
 *   a cloud provider variable, the container path, the desktop switch or the hostname;
 * - every request goes through the SDK's client: no other HTTP client, no `fetch(` and no socket
 *   module in the plugin's own code. One file is the named exception: the App Launcher's reads
 *   (`launcher/launcher-reads.ts`), two Ever Platform reads the operation table of the pinned SDK
 *   release does not carry yet, and Ever Works' public catalog, made under the SDK transport's rules
 *   and only to their fixed paths (checked below). It moves to the SDK client once the SDK has them.
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
	// The global `fetch` itself, called or handed on (its type, `typeof globalThis.fetch`, is not a use).
	['globalThis.fetch', /(?<!typeof\s+)\bglobalThis\.fetch\b/],
	['node:http(s)/net/tls/dgram', /from\s+['"](node:)?(https?|net|tls|dgram|http2)['"]/]
];

/** The App Launcher's reads: the one file of the plugin that sends requests itself (see above). */
const LAUNCHER_READS = join('ever-connect', 'src', 'lib', 'launcher', 'launcher-reads.ts');

export function sources(root: string): Array<{ path: string; text: string }> {
	const out: Array<{ path: string; text: string }> = [];
	for (const entry of readdirSync(root)) {
		const path = join(root, entry);
		if (statSync(path).isDirectory()) {
			if (entry !== 'fixtures') out.push(...sources(path));
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

	it('call Ever Platform only through the SDK client (the API plugin), but for the App Launcher reads', () => {
		const api = files.filter(({ path }) => path.includes(join('plugins', 'ever-connect', 'src')));
		expect(clients(api.filter(({ path }) => !path.endsWith(LAUNCHER_READS)))).toEqual([]);
	});

	it('the App Launcher reads use one fetch of their own, and only their three fixed paths', () => {
		const reads = files.find(({ path }) => path.endsWith(LAUNCHER_READS));
		expect(reads).toBeDefined();
		expect(clients([reads])).toEqual([`${reads.path}: fetch(`, `${reads.path}: globalThis.fetch`]);
		// The code without its comments: every path it can send to.
		const code = reads.text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
		const paths = [...code.matchAll(/(\/(?:api|v1)\/[^`'"\s]*)/g)].map((match) => match[1]);
		expect(paths.sort()).toEqual([
			'/api/app-launcher/platforms',
			'/v1/orgs/${this.segment(org)}/apps?limit=${APPS_PAGE_SIZE}',
			'/v1/orgs/${this.segment(org)}/installs'
		]);
	});

	it('would catch a planted read or call (control)', () => {
		expect(
			inferences([{ path: 'planted.ts', text: "const cloud = !!process.env['STRIPE_SECRET_KEY'];" }])
		).toHaveLength(1);
		expect(clients([{ path: 'planted.ts', text: "await fetch('https://api.ever.co/v1/x');" }])).toHaveLength(1);
		expect(clients([{ path: 'planted.ts', text: "import { HttpService } from '@nestjs/axios';" }])).toHaveLength(1);
	});
});
