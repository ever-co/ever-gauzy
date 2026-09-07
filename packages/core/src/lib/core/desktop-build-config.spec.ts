import * as fs from 'fs';
import * as path from 'path';

/**
 * The six separately-published Electron apps in this monorepo. All of them auto-update from a
 * shared CDN, so a signature-verification regression in any one of them is a code-execution path
 * onto every host running that app (GHSA-j75p-23jm-f83g).
 */
const DESKTOP_APPS = ['desktop', 'desktop-timer', 'server', 'server-api', 'agent', 'server-mcp'];

/** Repository root, resolved from this file's location (packages/core/src/lib/core). */
const REPO_ROOT = path.resolve(__dirname, '../../../../..');

describe('desktop app build configuration', () => {
	describe.each(DESKTOP_APPS)('apps/%s', (app) => {
		const manifestPath = path.join(REPO_ROOT, 'apps', app, 'src', 'package.json');

		it('has a readable build manifest', () => {
			expect(fs.existsSync(manifestPath)).toBe(true);
		});

		it('does not disable Authenticode verification for updates', () => {
			const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
			const win = manifest?.build?.win ?? {};

			// `verifyUpdateCodeSignature: false` switches off electron-updater's Authenticode check on
			// the downloaded installer, so a tampered artifact served from the update CDN installs
			// silently. It must never come back — including as a "temporary" unblock for a failing
			// signing step.
			expect(win.verifyUpdateCodeSignature).not.toBe(false);
		});
	});
});
