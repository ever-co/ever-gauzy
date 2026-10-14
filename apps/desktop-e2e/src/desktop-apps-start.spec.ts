import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { appTarget, runDir, type DesktopAppName } from './support/config';
import { closeDesktopApp, desktopRegistryGuard, launchDesktopApp, restoreRegistry, windowWith, type DesktopApp } from './support/desktop-app';

/**
 * Every packaged desktop app starts and opens its first window — on a fresh user data directory, so on
 * the first-start path (database migration, setup or splash window). An app that throws while its main
 * script loads never gets there: Electron parks it on a "JavaScript error in the main process" box.
 *
 * An app that is not packaged (no electron-builder `--dir` output) is skipped, so this can run right after
 * packaging any one of them, without the API: `DESKTOP_E2E_API=off yarn nx e2e desktop-e2e -- desktop-apps-start --grep agent`.
 */
const APPS: DesktopAppName[] = ['desktop-timer', 'desktop', 'server', 'server-api', 'agent', 'server-mcp'];

for (const name of APPS) {
	test(`${name}: the packaged app starts and opens its first window`, async () => {
		const target = appTarget(name);
		test.skip(!existsSync(target.executablePath), `${name} is not packaged (${target.executablePath})`);
		const registry = desktopRegistryGuard();
		let desktop: DesktopApp | undefined;
		try {
			desktop = await launchDesktopApp(target);
			const first = await windowWith(desktop, 'file://', 300_000);
			await first.waitForLoadState('domcontentloaded');
			const path = join(runDir, 'steps', `start-${name}.png`);
			await first.screenshot({ path }).catch(() => undefined);
			if (existsSync(path)) await test.info().attach(`start-${name}`, { path, contentType: 'image/png' });
			console.log(`[desktop-e2e] ${name}: first window ${first.url()}`);
			const log = readFileSync(desktop.log, 'utf8');
			expect(log, 'no main-process load error').not.toMatch(/App threw an error during load|A JavaScript error occurred in the main process/);
		} finally {
			await closeDesktopApp(desktop);
			restoreRegistry(registry);
		}
	});
}
