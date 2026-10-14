import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page, type Response } from '@playwright/test';
import { apiCwd, apiDatabase, apiUrl, appTarget, assertAppTargetExists, runDir, startsApi, userDataDir, type AppTarget } from './support/config';
import { blockedHosts, closeDesktopApp, desktopRegistryGuard, exited, launchDesktopApp, restoreRegistry, windowWith, type DesktopApp } from './support/desktop-app';
import { eventually, GauzyApi, type Session } from './support/gauzy-api';
import type { RegistryGuard } from './support/registry';

/**
 * The desktop timer's most important flow, end to end, on the packaged app:
 *
 *   first start → setup wizard points the app at a local API → the app restarts → login as an employee →
 *   Start → the app captures and uploads screenshots (at start and on the 1-minute interval) → Stop →
 *   the API has the time log, its time slots and the screenshot rows, and serves the screenshot files.
 *
 * The API and the account are the demo seed's (`employee@ever.co`). The run dir (see support/config.ts)
 * keeps the API database, the uploaded files, the app's user data and logs, and screenshots of each step.
 */
const ADMIN = {
	email: process.env['DESKTOP_E2E_ADMIN_EMAIL'] || 'admin@ever.co',
	password: process.env['DESKTOP_E2E_ADMIN_PASSWORD'] || 'admin'
};
const EMPLOYEE = {
	email: process.env['DESKTOP_E2E_EMPLOYEE_EMAIL'] || 'employee@ever.co',
	password: process.env['DESKTOP_E2E_EMPLOYEE_PASSWORD'] || '12345678'
};

test.describe.configure({ mode: 'serial' });

let target: AppTarget;
let desktop: DesktopApp | undefined;
let registry: RegistryGuard | undefined;

test.beforeAll(() => {
	target = appTarget();
	assertAppTargetExists(target);
	console.log(`[desktop-e2e] app: ${target.description}`);
	console.log(`[desktop-e2e] API: ${apiUrl}${startsApi ? ` (started by the suite, db ${apiDatabase})` : ''}`);
	console.log(`[desktop-e2e] run dir: ${runDir}`);
	registry = desktopRegistryGuard();
});

test.afterAll(async () => {
	await closeDesktopApp(desktop);
	restoreRegistry(registry);
	const refused = await blockedHosts();
	if (refused.length) console.log(`[desktop-e2e] the app tried to reach (refused by the test proxy): ${refused.join(', ')}`);
});

/**
 * Collects every toast the window shows from now on (they disappear after a few seconds, and the
 * renderer's console does not reach the test): `toasts(page)` returns them.
 */
async function recordToasts(page: Page): Promise<void> {
	await page.evaluate(() => {
		const w = window as unknown as { __e2eToasts?: string[] };
		if (w.__e2eToasts) return;
		const seen: string[] = (w.__e2eToasts = []);
		new MutationObserver(() => {
			document.querySelectorAll('nb-toast').forEach((t) => {
				const text = (t as HTMLElement).innerText.replace(/\s+/g, ' ').trim();
				if (text && !seen.includes(text)) seen.push(text);
			});
		}).observe(document.body, { childList: true, subtree: true });
	});
}

async function toasts(page: Page): Promise<string[]> {
	return page.evaluate(() => (window as unknown as { __e2eToasts?: string[] }).__e2eToasts ?? []).catch(() => []);
}

/** Saves a screenshot of an app window into the run dir and the report. */
async function snap(page: Page, name: string): Promise<void> {
	const path = join(runDir, 'steps', `${name}.png`);
	await page.screenshot({ path }).catch(() => undefined);
	if (existsSync(path)) await test.info().attach(name, { path, contentType: 'image/png' });
	// What the app told the user (Nebular toasts), next to the screenshot in the output.
	const visible = await page.locator('nb-toast').allInnerTexts().catch(() => [] as string[]);
	if (visible.length) console.log(`[desktop-e2e] ${name}: toasts: ${visible.map((t) => t.replace(/\s+/g, ' ').trim()).join(' | ')}`);
}

/** The next response of the app's renderer for `path` (method + status checked by the caller). */
function nextResponse(page: Page, method: string, path: string, timeout: number): Promise<Response> {
	return page.waitForResponse((res) => res.request().method() === method && new URL(res.url()).pathname === path, { timeout });
}

test('desktop timer: setup, login, timer with screenshots recorded by the API', async () => {
	const api = new GauzyApi(apiUrl);
	let admin: Session;
	let employee: { id: string; organizationId: string; tenantId: string; userId: string };
	const startedAt = new Date();

	await test.step('the API is up with the demo seed and the employee may track time', async () => {
		admin = await eventually(() => api.login(ADMIN.email, ADMIN.password), 10 * 60_000);
		const self = await eventually(() => api.login(EMPLOYEE.email, EMPLOYEE.password), 5 * 60_000);
		// The same user/me call the desktop timer makes after login.
		const me = await api.get(self, '/api/user/me', { includeEmployee: true, includeOrganization: true });
		expect(me.employee, `${EMPLOYEE.email} is an employee`).toBeTruthy();
		expect(me.employee.isTrackingEnabled, 'time tracking enabled for the employee (demo seed)').toBe(true);
		expect(me.employee.allowScreenshotCapture, 'screenshots allowed for the employee').not.toBe(false);
		employee = { id: me.employee.id, organizationId: me.employee.organizationId, tenantId: me.tenantId, userId: me.id };

		// The organization's timer settings, changed the way its settings page does (the whole organization is
		// PUT back): a screenshot every minute — enforced, so it overrides the app's 10-minute default — and no
		// inactivity check (an unattended machine is idle, which would make the app stop the timer).
		const organization = await api.get(admin, `/api/organization/${employee.organizationId}`, {});
		await api.put(admin, `/api/organization/${employee.organizationId}`, {
			...organization,
			allowScreenshotCapture: true,
			allowTrackInactivity: false,
			enforced: true,
			screenshotFrequency: 1,
			randomScreenshot: false,
			trackOnSleep: true
		});
		const updated = await api.get(admin, `/api/organization/${employee.organizationId}`, {});
		expect(updated).toMatchObject({ allowTrackInactivity: false, enforced: true, screenshotFrequency: 1 });
		expect(updated, 'no project/task/client/description required to start the timer').toMatchObject({
			requireProject: false,
			requireTask: false,
			requireClient: false,
			requireDescription: false
		});
	});

	await test.step('first start: the setup wizard connects the app to the local API', async () => {
		desktop = await launchDesktopApp(target);
		// The first start migrates the app's own database before the setup window opens; on a busy machine the
		// startup window alone has taken minutes to render.
		const setup = await windowWith(desktop, '#/setup', 600_000);
		await setup.waitForLoadState('domcontentloaded');
		await snap(setup, '01-setup-welcome');

		await setup.locator('button.button-home:visible').first().click();
		await setup.locator('nb-radio:visible').filter({ hasText: /custom|network/i }).first().click();
		await setup.locator('button.btn-next:visible').first().click();

		// Third-party integrations off: neither ActivityWatch nor Wakatime runs here.
		const integrations = setup.locator('nb-checkbox:visible');
		await expect(integrations.first()).toBeVisible();
		for (const box of await integrations.all()) {
			if (await box.locator('input[type=checkbox]').isChecked()) await box.locator('label, .custom-checkbox').first().click();
		}
		await setup.locator('button.btn-next:visible').first().click();

		const url = new URL(apiUrl);
		await setup.locator('input[type=text][nbinput]:visible').first().fill(`${url.protocol}//${url.hostname}`);
		await setup.locator('input[type=number]:visible').first().fill(url.port || (url.protocol === 'https:' ? '443' : '80'));
		await snap(setup, '02-setup-server');

		// Saving restarts the app (`app.relaunch()` + `app.exit()`): the first process exits and a new one
		// starts with the same command line (same user data, same DevTools port).
		await setup.locator('button.btn-next:visible').filter({ hasText: /save/i }).first().click();
		await exited(desktop, 90_000);

		const store = JSON.parse(readFileSync(join(userDataDir, 'config.json'), 'utf8'));
		expect(store.configs).toMatchObject({ isSetup: true, isLocalServer: false, serverUrl: `${url.protocol}//${url.hostname}:${url.port}` });
	});

	let tracker: Page;
	await test.step('after the restart: login as the employee', async () => {
		tracker = await windowWith(desktop as DesktopApp, '#/auth/login', 600_000);
		// Typed like a user: the form validates on keystrokes, and Log In stays disabled until it is valid.
		await tracker.locator('#input-email').pressSequentially(EMPLOYEE.email, { delay: 20 });
		await tracker.locator('#input-password').pressSequentially(EMPLOYEE.password, { delay: 20 });
		const submit = tracker.locator('button.submit-btn');
		await expect(submit).toBeEnabled({ timeout: 30_000 });
		await snap(tracker, '03-login');
		// The desktop signs in with email + password, then into the workspace (with one workspace, automatically).
		const signIn = nextResponse(tracker, 'POST', '/api/auth/signin.email.password', 60_000);
		await submit.click();
		expect((await signIn).status()).toBeLessThan(300);
		await tracker.waitForURL(/#\/time-tracker/, { timeout: 120_000 });
	});

	const start = () => tracker.locator('button[status="success"]').filter({ has: tracker.locator('nb-icon[icon="play"]') });
	const stop = () => tracker.locator('button[status="danger"]').filter({ has: tracker.locator('nb-icon[icon="pause"]') });
	/** Every screenshot upload the app makes: when, and what the API answered. */
	const uploads: { at: number; status: number; recorded: boolean }[] = [];
	const uploaded = (since: number, timeout: number) =>
		tracker.waitForResponse(
			(res) => res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/timesheet/screenshot' && Date.now() >= since,
			{ timeout }
		);

	await test.step('Start: the timer runs on the API and the first capture is uploaded', async () => {
		await expect(start()).toBeEnabled({ timeout: 180_000 });
		await snap(tracker, '04-tracker-ready');
		tracker.on('response', async (res) => {
			if (res.request().method() !== 'POST' || new URL(res.url()).pathname !== '/api/timesheet/screenshot') return;
			const at = Date.now();
			const body = await res.text().catch(() => '');
			uploads.push({ at, status: res.status(), recorded: body.includes('"id"') });
		});
		await recordToasts(tracker);
		const calls: string[] = [];
		tracker.on('request', (req) => {
			if (req.url().startsWith(apiUrl)) calls.push(`${req.method()} ${new URL(req.url()).pathname}`);
		});
		const timerStart = nextResponse(tracker, 'POST', '/api/timesheet/timer/start', 120_000);
		const firstShot = uploaded(0, 180_000);
		firstShot.catch(() => undefined); // awaited below; a failed start is reported first
		await start().click();
		const started = await timerStart.catch(async (error) => {
			await snap(tracker, '05-start-failed');
			console.log(`[desktop-e2e] after Start: toasts ${JSON.stringify(await toasts(tracker))}; API calls ${JSON.stringify(calls)}`);
			throw error;
		});
		expect(started.status()).toBeLessThan(300);
		expect((await firstShot).status()).toBeLessThan(300);
		await expect(stop()).toBeVisible();
		await snap(tracker, '05-tracking');
	});

	await test.step('one screenshot interval (1 minute) later: the next capture is uploaded too', async () => {
		// Each capture uploads one image per display, all within seconds: the next capture is the first
		// upload at least 40 s after the first one.
		const next = await uploaded((uploads[0]?.at ?? Date.now()) + 40_000, 3 * 60_000);
		expect(next.status()).toBeLessThan(300);
		await snap(tracker, '06-after-interval');
	});

	await test.step('Stop: the timer stops on the API', async () => {
		const timerStop = nextResponse(tracker, 'POST', '/api/timesheet/timer/stop', 120_000);
		await stop().click();
		expect((await timerStop).status()).toBeLessThan(300);
		await expect(start()).toBeVisible();
		await snap(tracker, '07-stopped');
	});

	await test.step('the API has the time log, its time slots and the screenshots, and serves the files', async () => {
		// Time slots are 10-minute buckets: the first one starts before the timer did.
		const window = { startDate: new Date(startedAt.getTime() - 15 * 60_000).toISOString(), endDate: new Date(Date.now() + 60_000).toISOString() };
		const session = await api.login(EMPLOYEE.email, EMPLOYEE.password);
		const scope = { organizationId: employee.organizationId, tenantId: employee.tenantId, employeeIds: [employee.id], ...window };

		const logs = await eventually(async () => {
			const found = await api.get(session, '/api/timesheet/time-log', scope);
			const mine = (Array.isArray(found) ? found : found.items).filter(
				(l: any) => l.employeeId === employee.id && l.source === 'DESKTOP' && new Date(l.startedAt) >= startedAt
			);
			if (!mine.length || mine.some((l: any) => l.isRunning)) throw new Error(`time logs: ${JSON.stringify(mine)}`);
			return mine;
		}, 60_000);
		expect(logs.length, 'stopped DESKTOP time log of this run').toBe(1);

		const slots = (await api.get(session, '/api/timesheet/time-slot', { ...scope, relations: ['screenshots', 'timeLogs'] })).filter(
			(slot: any) => (slot.timeLogs ?? []).some((log: any) => log.id === logs[0].id)
		);
		expect(slots.length, 'time slots of the time log').toBeGreaterThanOrEqual(1);
		const screenshots = slots.flatMap((slot: any) => slot.screenshots ?? []);
		// Two capture moments at least: the one at Start and the one a screenshot interval later.
		const moments = new Set(screenshots.map((shot: any) => Math.round(new Date(shot.recordedAt).getTime() / 30_000)));
		expect(screenshots.length, 'screenshot rows').toBeGreaterThanOrEqual(2);
		expect(moments.size, 'distinct capture moments among the screenshot rows').toBeGreaterThanOrEqual(2);

		for (const shot of screenshots) {
			expect(shot.file, 'stored file key').toBeTruthy();
			for (const url of [shot.fullUrl, shot.thumbUrl]) {
				const served = await api.fetchPublic(url);
				expect(served.status, `GET ${url}`).toBe(200);
				expect(served.contentType, `GET ${url}`).toMatch(/^image\//);
				expect(served.bytes, `GET ${url}`).toBeGreaterThan(500);
			}
			if (startsApi) expect(existsSync(join(apiCwd, 'apps', 'api', 'public', shot.file)), `file ${shot.file} on disk`).toBe(true);
		}

		writeFileSync(join(runDir, 'recorded.json'), JSON.stringify({ employee, logs, slots, uploads }, null, 2));
		const lost = uploads.filter((u) => u.status < 300 && !u.recorded).length;
		console.log(
			`[desktop-e2e] recorded: ${logs.length} time log, ${slots.length} time slot(s), ${screenshots.length} screenshot(s) from ${moments.size} capture(s); ` +
				`${uploads.length} upload(s) seen in the app${lost ? `, ${lost} answered 2xx without creating a screenshot` : ''}`
		);
	});
});
