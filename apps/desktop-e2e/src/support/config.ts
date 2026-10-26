import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join, parse, resolve } from 'node:path';

/**
 * Everything the suite needs to know about where things are, from environment variables with defaults
 * that fit a checkout where `yarn build:desktop-timer` + electron-builder `--dir` and the API build ran.
 *
 * | variable | default | what |
 * |---|---|---|
 * | `DESKTOP_E2E_RUN_DIR` | `<repo>/dist/desktop-e2e/<timestamp>` | per-run directory: API database, API uploads, app user data |
 * | `DESKTOP_E2E_API_URL` | — | use an API that is already running (nothing is started; it must have the demo seed) |
 * | `DESKTOP_E2E_API_PORT` | `3131` | port of the API the suite starts |
 * | `DESKTOP_E2E_API_MAIN` | `<repo>/dist/apps/api/main.js` | the built API it starts |
 * | `DESKTOP_E2E_DIST` | `<repo>/dist` | where the built apps and their electron-builder `--dir` output are |
 * | `DESKTOP_TIMER_EXECUTABLE` | the electron-builder `--dir` output for this OS | the packaged desktop timer |
 * | `DESKTOP_TIMER_APP_DIR` + `DESKTOP_TIMER_ELECTRON` | — | instead: an unpacked app directory run by an Electron binary |
 */
export const repoRoot = resolve(__dirname, '..', '..', '..', '..');

/** One directory per run. Fixed in the environment on first load: Playwright loads this module in every worker. */
export const runDir = (process.env['DESKTOP_E2E_RUN_DIR'] ??= join(
	repoRoot,
	'dist',
	'desktop-e2e',
	new Date().toISOString().replace(/[:.]/g, '-')
));

export const apiPort = Number(process.env['DESKTOP_E2E_API_PORT'] || 3131);

/** 127.0.0.1, not localhost: the app's Chromium bypasses the test's dead proxy for loopback addresses only. */
export const apiUrl = (process.env['DESKTOP_E2E_API_URL'] || `http://127.0.0.1:${apiPort}`).replace(/\/+$/, '');

export const startsApi = !process.env['DESKTOP_E2E_API_URL'];

export const apiMain = process.env['DESKTOP_E2E_API_MAIN'] || join(repoRoot, 'dist', 'apps', 'api', 'main.js');

/** The API's working directory: its uploads and the demo seed's clean-up land here, never in the checkout. */
export const apiCwd = join(runDir, 'api');

export const apiDatabase = join(runDir, 'api', 'gauzy.sqlite3');

/**
 * On Windows the API must run from the drive its build is on: TypeORM joins the migration paths onto the
 * working directory's drive (`F:\E:\...\migrations\x.js`, "Cannot find module"). Throws early with the fix.
 */
export function assertApiCwdOnBuildDrive(): void {
	if (process.platform !== 'win32' || !startsApi || !existsSync(apiMain)) return;
	const buildDrive = parse(realpathSync(apiMain)).root.toUpperCase();
	const cwdDrive = parse(resolve(apiCwd)).root.toUpperCase();
	if (buildDrive !== cwdDrive)
		throw new Error(
			`The API build is on ${buildDrive} (${realpathSync(apiMain)}) but the run directory is on ${cwdDrive}; ` +
				`set DESKTOP_E2E_RUN_DIR to a directory on ${buildDrive}`
		);
}

/** Each app gets its own user data directory (electron-store config, SQLite DB, logs), passed as `--user-data-dir`. */
export const userDataDirOf = (app: DesktopAppName): string => join(runDir, `${app}-user-data`);

/** The desktop timer's user data directory. */
export const userDataDir = userDataDirOf('desktop-timer');

export type DesktopAppName = 'desktop-timer' | 'desktop' | 'server' | 'server-api' | 'agent' | 'server-mcp';

/** Where `yarn build:<app>` leaves each app (the electron-builder `--project`). */
export const DIST_DIR: Record<DesktopAppName, string> = {
	'desktop-timer': 'desktop-timer',
	desktop: 'desktop',
	server: 'gauzy-server',
	'server-api': 'gauzy-api-server',
	agent: 'agent',
	'server-mcp': 'server-mcp'
};

/** The deep-link protocol each app registers on its first start (Windows: `HKCU\Software\Classes\<protocol>`). */
export const PROTOCOLS = ['gauzy-timer', 'gauzy-desktop', 'gauzy-server', 'gauzy-api-server', 'gauzy-agent', 'gauzy-mcp-server'];

/** The app id each app is released with (`build.appId`), when its built manifest does not say. */
const APP_IDS: Record<DesktopAppName, string> = {
	'desktop-timer': 'com.ever.gauzydesktoptimer',
	desktop: 'com.ever.gauzydesktop',
	server: 'com.ever.gauzyserver',
	'server-api': 'com.ever.gauzyapiserver',
	agent: 'com.ever.gauzyagent',
	'server-mcp': 'com.ever.gauzymcpserver'
};

interface BuiltManifest {
	dist: string;
	name: string;
	build: { appId?: string; productName?: string; directories?: { output?: string }; linux?: { executableName?: string } };
}

/** The app's built `package.json` (name, electron-builder config). Empty when the app is not built. */
function builtManifest(app: DesktopAppName): BuiltManifest {
	const dist = join(process.env['DESKTOP_E2E_DIST'] || join(repoRoot, 'dist'), 'apps', DIST_DIR[app]);
	try {
		const manifest = JSON.parse(readFileSync(join(dist, 'package.json'), 'utf8'));
		return { dist, name: manifest.name ?? app, build: manifest.build ?? {} };
	} catch {
		// not built: the paths derived from it will not exist and the caller says so
		return { dist, name: app, build: {} };
	}
}

/**
 * The value names the apps write into the Windows login-item keys (`HKCU\…\CurrentVersion\Run`,
 * `…\Explorer\StartupApproved\Run`): Electron's `setLoginItemSettings` names the value after the app user model
 * id — the app id the app sets at start, or Electron's default `electron.app.<product name>`.
 */
export function loginItemNames(): string[] {
	return (Object.keys(DIST_DIR) as DesktopAppName[]).flatMap((app) => {
		const { name, build } = builtManifest(app);
		return [...new Set([build.appId ?? APP_IDS[app], APP_IDS[app], `electron.app.${build.productName ?? name}`])];
	});
}

/** The electron-builder `--dir` output of an app, from its built manifest (product name, output directory). */
export function packagedExecutable(app: DesktopAppName): string {
	const { dist, name, build } = builtManifest(app);
	const productName = build.productName ?? name;
	const out = resolve(dist, build.directories?.output ?? 'dist');
	switch (process.platform) {
		case 'win32':
			return join(out, 'win-unpacked', `${productName}.exe`);
		case 'darwin':
			return join(out, process.arch === 'arm64' ? 'mac-arm64' : 'mac', `${productName}.app`, 'Contents', 'MacOS', productName);
		default:
			return join(out, 'linux-unpacked', build.linux?.executableName ?? name);
	}
}

export interface AppTarget {
	app: DesktopAppName;
	executablePath: string;
	args: string[];
	description: string;
}

/**
 * What to launch: the packaged app (default). For the desktop timer, DESKTOP_TIMER_EXECUTABLE overrides the path,
 * and DESKTOP_TIMER_APP_DIR + DESKTOP_TIMER_ELECTRON run an unpacked app directory with a given Electron binary.
 */
export function appTarget(app: DesktopAppName = 'desktop-timer'): AppTarget {
	const appDir = app === 'desktop-timer' ? process.env['DESKTOP_TIMER_APP_DIR'] : undefined;
	if (appDir) {
		const electron = process.env['DESKTOP_TIMER_ELECTRON'];
		if (!electron) throw new Error('DESKTOP_TIMER_APP_DIR needs DESKTOP_TIMER_ELECTRON (the Electron binary that runs it)');
		return { app, executablePath: electron, args: [resolve(appDir)], description: `${electron} ${appDir}` };
	}
	const override = app === 'desktop-timer' ? process.env['DESKTOP_TIMER_EXECUTABLE'] : undefined;
	const executablePath = override || packagedExecutable(app);
	return { app, executablePath, args: [], description: executablePath };
}

export function assertAppTargetExists(target: AppTarget): void {
	if (!existsSync(target.executablePath)) {
		throw new Error(
			`${target.app} not found at ${target.executablePath}. Build and package it first (see apps/desktop-e2e/README.md)` +
				(target.app === 'desktop-timer' ? ', or point DESKTOP_TIMER_EXECUTABLE (or DESKTOP_TIMER_APP_DIR + DESKTOP_TIMER_ELECTRON) at one.' : '.')
		);
	}
}
