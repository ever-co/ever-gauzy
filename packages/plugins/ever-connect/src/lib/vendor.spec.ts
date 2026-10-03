import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * `src/lib/vendor/` is the Ever Platform SDK's code, copied by `scripts/vendor-connect-sdk.mjs` at the
 * commit `VENDOR.json` names. Every vendored file must equal what the script wrote (no hand edit),
 * carry the header naming that commit, and no other file may sit in the directory. With
 * `EVER_CONNECT_SDK_DIR` pointing at a checkout of that commit, the script's `--check` compares the
 * copy with the upstream files too (CI runs it).
 */
const VENDOR = join(__dirname, 'vendor');
const manifest = JSON.parse(readFileSync(join(VENDOR, 'VENDOR.json'), 'utf8')) as {
	commit: string;
	files: Record<string, { upstream: string; upstream_sha256: string; sha256: string }>;
};

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

function listed(root: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(root)) {
		const path = join(root, entry);
		if (statSync(path).isDirectory()) out.push(...listed(path));
		else out.push(relative(VENDOR, path).split('\\').join('/'));
	}
	return out;
}

describe('the vendored Ever Platform SDK', () => {
	it('names a full commit', () => {
		expect(manifest.commit).toMatch(/^[0-9a-f]{40}$/);
	});

	it.each(Object.entries(manifest.files))('%s is unchanged since it was vendored', (path, entry) => {
		const text = readFileSync(join(VENDOR, path), 'utf8');
		expect(sha256(text)).toBe(entry.sha256);
		if (path.endsWith('.ts')) {
			expect(text.split('\n')[0]).toBe(
				`// Vendored from github.com/ever-co/ever-connect-sdk@${manifest.commit} (${entry.upstream}) by scripts/vendor-connect-sdk.mjs. Do not edit.`
			);
		}
	});

	it('holds nothing else', () => {
		expect(listed(VENDOR).sort()).toEqual([...Object.keys(manifest.files), 'VENDOR.json'].sort());
	});

	const sdk = process.env['EVER_CONNECT_SDK_DIR'];
	(sdk && existsSync(sdk) ? it : it.skip)('equals the upstream files of that commit (EVER_CONNECT_SDK_DIR)', () => {
		const head = execFileSync('git', ['-C', sdk as string, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
		expect(head).toBe(manifest.commit);
		for (const entry of Object.values(manifest.files)) {
			expect(sha256(readFileSync(join(sdk as string, entry.upstream), 'utf8'))).toBe(entry.upstream_sha256);
		}
	});
});
