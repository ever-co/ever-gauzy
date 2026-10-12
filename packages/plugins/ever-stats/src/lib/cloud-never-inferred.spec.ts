import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `install_source` is declared, never guessed: no source of the three packages reads a payment key,
 * the demo switch, a cloud provider variable, the container path, the desktop switch, the Gauzy
 * cloud endpoint or the hostname. Specs are excluded (they name these to prove they are ignored).
 */
const FORBIDDEN = ['STRIPE_SECRET_KEY', 'process.env.DEMO', "process.env['DEMO']", 'CLOUD_PROVIDER', '/srv/gauzy', 'IS_ELECTRON', 'GAUZY_CLOUD_ENDPOINT', 'os.hostname', 'hostname()'];

export function sources(root: string): Array<{ path: string; text: string }> {
	const out: Array<{ path: string; text: string }> = [];
	for (const entry of readdirSync(root)) {
		const path = join(root, entry);
		if (statSync(path).isDirectory()) {
			out.push(...sources(path));
		} else if (/\.(ts|html)$/.test(entry) && !/\.spec\.ts$/.test(entry)) {
			out.push({ path, text: readFileSync(path, 'utf8') });
		}
	}
	return out;
}

export function inferences(files: Array<{ path: string; text: string }>): string[] {
	return files.flatMap(({ path, text }) => FORBIDDEN.filter((needle) => text.includes(needle)).map((needle) => `${path}: ${needle}`));
}

describe('install source is never inferred', () => {
	const roots = ['ever-instance', 'ever-stats', 'ever-stats-ui'].map((name) => join(__dirname, '../../..', name, 'src'));

	it('no package source reads a signal to guess it', () => {
		const files = roots.flatMap((root) => sources(root));
		expect(files.length).toBeGreaterThan(20);
		expect(inferences(files)).toEqual([]);
	});

	it('would catch a planted read (control)', () => {
		expect(inferences([{ path: 'planted.ts', text: "const cloud = !!process.env['STRIPE_SECRET_KEY'];" }])).toHaveLength(1);
		expect(inferences([{ path: 'planted.ts', text: 'const host = os.hostname();' }])).toHaveLength(2);
	});
});
