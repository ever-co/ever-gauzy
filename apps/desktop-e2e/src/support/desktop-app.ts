import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, sep } from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';
import { AppTarget, loginItemNames, PROTOCOLS, runDir, userDataDirOf } from './config';
import { RegistryGuard } from './registry';

/**
 * The app's proxy: it refuses every request at once (403) and records the host. Chromium sends every
 * non-loopback request of the app through it, so the run never reaches the internet (no GitHub update
 * check, no update download, no telemetry, no web fonts) while the renderer still reaches the API on
 * 127.0.0.1 (loopback bypasses the proxy). Node's HTTP stack in the main process (e.g. the updater's
 * GitHub release lookup with node-fetch) and in processes the app forks ignores that switch; the same
 * proxy reaches it through `NODE_USE_ENV_PROXY` + `HTTP(S)_PROXY`, with loopback in `NO_PROXY`
 * (Electron 44's main process honours them: an https request then fails at the proxy's 403 within ms).
 *
 * A port nobody listens on is not good enough on Windows: a refused connection to it takes seconds
 * (SYN retries), and the app's startup window then took minutes to load.
 */
let blockingProxy: Promise<{ url: string; blocked: Set<string> }> | undefined;

function refusingProxy(): Promise<{ url: string; blocked: Set<string> }> {
	blockingProxy ??= new Promise((resolve, reject) => {
		let blocked = new Set<string>();
		const server = createServer((socket) => {
			socket.once('data', (chunk) => {
				// "CONNECT host:443 HTTP/1.1" for HTTPS, "GET http://host/path HTTP/1.1" for plain HTTP.
				const target = chunk.toString('latin1').split(/\s+/)[1] ?? '?';
				blocked.add(target.replace(/^https?:\/\//, '').replace(/\/.*$/, ''));
				socket.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');
			});
			socket.on('error', () => undefined);
		});
		server.unref();
		server.on('error', reject);
		server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${(server.address() as { port: number }).port}`, blocked }));
	});
	return blockingProxy;
}

/** The hosts the app tried to reach outside the machine during this run (all refused). */
export async function blockedHosts(): Promise<string[]> {
	return blockingProxy ? [...(await blockingProxy).blocked].sort() : [];
}

/**
 * A running desktop app, driven over the Chrome DevTools Protocol.
 *
 * Why not Playwright's `_electron.launch`: it attaches to the app before the first window exists and
 * holds every new renderer at its start, and in the desktop timer's `nodeIntegration` windows that made
 * Node's `fs.realpathSync` — so every `window.require()` of a file module (`@electron/remote`,
 * `electron-log`) — throw "TypeError: no access" (Electron 44, Node 24.21): the time-tracker window
 * never came up. Attaching with `connectOverCDP` once a window exists leaves those renderers alone.
 * It also lets the app relaunch itself after the setup the way it does for a user: the relaunched
 * process gets the same command line, so the same fixed DevTools port.
 */
export interface DesktopApp {
	target: AppTarget;
	/** The process this suite started (a relaunch replaces it with one the app starts itself). */
	process: ChildProcess;
	pid: number;
	port: number;
	userDataDir: string;
	/** Where the started process's stdout/stderr and every attached window's console go. */
	log: string;
	browser?: Browser;
}

let launches = 0;

function freePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.unref();
		server.on('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const { port } = server.address() as { port: number };
			server.close(() => resolve(port));
		});
	});
}

export async function launchDesktopApp(target: AppTarget): Promise<DesktopApp> {
	const userDataDir = userDataDirOf(target.app);
	mkdirSync(userDataDir, { recursive: true });
	const log = join(runDir, `${target.app}-launch-${++launches}.log`);
	const port = await freePort();
	const proxy = await refusingProxy();
	const env = { ...process.env } as Record<string, string>;
	delete env['NODE_OPTIONS']; // packaged Electron refuses most NODE_OPTIONS; a dev's --experimental-vm-modules would only add noise
	delete env['ELECTRON_RUN_AS_NODE'];
	for (const name of ['HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'ALL_PROXY']) {
		delete env[name];
		delete env[name.toLowerCase()];
	}
	Object.assign(env, { NODE_USE_ENV_PROXY: '1', HTTP_PROXY: proxy.url, HTTPS_PROXY: proxy.url, NO_PROXY: 'localhost,127.0.0.1,::1' });
	const args = [
		...target.args,
		`--user-data-dir=${userDataDir}`,
		`--proxy-server=${proxy.url}`,
		`--remote-debugging-port=${port}`,
		'--lang=en-US',
		'--mute-audio' // the app plays a camera-shutter sound for every screenshot
	];
	// Off Windows the app leads a process group of its own, so the clean-up can stop the whole group.
	const detached = process.platform !== 'win32';
	const child = spawn(target.executablePath, args, { cwd: runDir, env, detached, stdio: ['ignore', 'pipe', 'pipe'] });
	const out = createWriteStream(log, { flags: 'a' });
	child.stdout?.on('data', (d) => out.writable && out.write(d));
	child.stderr?.on('data', (d) => out.writable && out.write(d));
	child.on('exit', (code, signal) => out.writable && out.write(`\n[desktop-e2e] process ${child.pid} exited: ${code ?? signal}\n`));
	logStreams.set(log, out);
	return { target, process: child, pid: child.pid as number, port, userDataDir, log };
}

const logStreams = new Map<string, WriteStream>();

/** The DevTools targets of the app (no attach). Empty while the app is not listening. */
async function targets(desktop: DesktopApp): Promise<{ type: string; url: string }[]> {
	try {
		const res = await fetch(`http://127.0.0.1:${desktop.port}/json/list`, { signal: AbortSignal.timeout(3_000) });
		return (await res.json()) as { type: string; url: string }[];
	} catch {
		return [];
	}
}

/**
 * The app's window whose URL contains `fragment` (e.g. `#/setup`). Waits until such a window exists,
 * then attaches Playwright (once per app process) and returns the window as a Playwright `Page`.
 */
export async function windowWith(desktop: DesktopApp, fragment: string, timeout = 120_000): Promise<Page> {
	const deadline = Date.now() + timeout;
	let seen: string[] = [];
	while (Date.now() < deadline) {
		const list = await targets(desktop);
		seen = list.map((t) => t.url);
		if (list.some((t) => t.type === 'page' && t.url.includes(fragment))) {
			const browser = await attach(desktop);
			const page = browser
				.contexts()
				.flatMap((c) => c.pages())
				.find((p) => !p.isClosed() && p.url().includes(fragment));
			if (page) return page;
		}
		await new Promise((r) => setTimeout(r, 1_000));
	}
	throw new Error(`no window with "${fragment}" within ${timeout} ms; windows: ${seen.join(', ') || 'none (app not listening)'}`);
}

async function attach(desktop: DesktopApp): Promise<Browser> {
	if (desktop.browser?.isConnected()) return desktop.browser;
	const browser = await chromium.connectOverCDP(`http://127.0.0.1:${desktop.port}`, { timeout: 60_000 });
	desktop.browser = browser;
	const out = logStreams.get(desktop.log);
	const route = (page: Page) => page.url().replace(/^.*#/, '#') || page.url();
	const listen = (page: Page) => {
		page.on('console', (m) => out?.writable && out.write(`[renderer ${route(page)}] ${m.type()}: ${m.text()}\n`));
		page.on('pageerror', (e) => out?.writable && out.write(`[renderer ${route(page)}] pageerror: ${e.message}\n`));
		// Failed API calls are the first thing to look at when a step stalls.
		page.on('response', (r) => {
			if (r.status() >= 400 && out?.writable) out.write(`[renderer ${route(page)}] HTTP ${r.status()} ${r.request().method()} ${r.url()}\n`);
		});
		page.on('requestfailed', (r) => {
			if (out?.writable) out.write(`[renderer ${route(page)}] request failed: ${r.method()} ${r.url()} ${r.failure()?.errorText ?? ''}\n`);
		});
	};
	for (const context of browser.contexts()) {
		context.pages().forEach(listen);
		context.on('page', listen);
	}
	return browser;
}

/**
 * Resolves when the process this suite started has exited — e.g. after the
 * setup, which ends with `app.relaunch()` + `app.exit()`.
 */
export async function exited(desktop: DesktopApp, timeout = 60_000): Promise<void> {
	const child = desktop.process;
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		if (child.exitCode !== null || child.signalCode !== null) {
			await desktop.browser?.close().catch(() => undefined);
			desktop.browser = undefined;
			return;
		}
		await new Promise((r) => setTimeout(r, 500));
	}
	throw new Error(`${desktop.target.app} (pid ${desktop.pid}) still running after ${timeout} ms`);
}

/**
 * Quits the app (CDP `Browser.close`, which Electron handles like a user's quit), then makes sure nothing
 * of it survives: the started process tree (off Windows: its process group) and every process still running
 * from the build under test — a relaunched app (`app.relaunch()` starts it outside the first process's
 * tree and group), the forked desktop API. Processes of other installations are never touched.
 */
export async function closeDesktopApp(desktop: DesktopApp | undefined): Promise<void> {
	if (!desktop) return;
	try {
		const browser = desktop.browser?.isConnected()
			? desktop.browser
			: (await targets(desktop)).length
				? await chromium.connectOverCDP(`http://127.0.0.1:${desktop.port}`, { timeout: 10_000 })
				: undefined;
		if (browser) {
			const session = await browser.newBrowserCDPSession();
			await Promise.race([session.send('Browser.close').catch(() => undefined), new Promise((r) => setTimeout(r, 10_000))]);
			await browser.close().catch(() => undefined);
		}
	} catch {
		// fall through to the kill below
	}
	const deadline = Date.now() + 15_000;
	while (Date.now() < deadline && (await targets(desktop)).length) await new Promise((r) => setTimeout(r, 500));
	killTree(desktop.pid);
	killProcessesOf(desktop.target.executablePath);
	logStreams.get(desktop.log)?.end();
}

function killTree(pid: number): void {
	try {
		if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
		else process.kill(-pid, 'SIGKILL'); // the group the app leads (spawned detached)
	} catch {
		// already gone
	}
}

/** Stops every process running from the build under test, matched by its executable (Windows) or install directory. */
function killProcessesOf(executablePath: string): void {
	let killed: number[] = [];
	try {
		if (process.platform === 'win32') {
			const script =
				`$p = $env:GAUZY_E2E_EXE; Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $p } | ` +
				`ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $_.ProcessId }`;
			killed = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
				env: { ...process.env, GAUZY_E2E_EXE: executablePath },
				encoding: 'utf8'
			})
				.split(/\s+/)
				.filter(Boolean)
				.map(Number);
		} else {
			// Every process of an unpacked Linux app runs an executable in its directory; on macOS, in its .app bundle
			// (the helpers live in Contents/Frameworks).
			const root = /^(.*?\.app)\//.exec(executablePath)?.[1] ?? dirname(executablePath);
			const prefix = root.endsWith(sep) ? root : root + sep;
			for (const line of execFileSync('ps', ['-axo', 'pid=,args='], { encoding: 'utf8' }).split('\n')) {
				const match = /^\s*(\d+)\s+(.*)$/.exec(line);
				if (!match || !match[2].startsWith(prefix) || Number(match[1]) === process.pid) continue;
				try {
					process.kill(Number(match[1]), 'SIGKILL');
					killed.push(Number(match[1]));
				} catch {
					// gone in the meantime
				}
			}
		}
	} catch {
		// nothing left
	}
	if (killed.length) console.log(`[desktop-e2e] stopped leftover processes of the build under test: ${killed.join(', ')}`);
}

/**
 * Snapshots the Windows keys the desktop apps write on their first start — the login items (`Run`,
 * `StartupApproved\Run`: only the values named after the apps' ids — the same values an installed release
 * uses; other programs' login items are neither compared nor touched) and the deep-link protocols — so
 * `restore()` can put back exactly what a run changed. Undefined off Windows.
 */
export function desktopRegistryGuard(): RegistryGuard | undefined {
	if (!RegistryGuard.supported) return undefined;
	const software = 'HKEY_CURRENT_USER\\Software';
	const names = loginItemNames();
	const guard = new RegistryGuard()
		.watchValues(`${software}\\Microsoft\\Windows\\CurrentVersion\\Run`, names)
		.watchValues(`${software}\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run`, names);
	for (const protocol of PROTOCOLS) guard.watchTree(`${software}\\Classes\\${protocol}`);
	return guard;
}

/** Puts the registry back and logs what the run had changed. */
export function restoreRegistry(guard: RegistryGuard | undefined): void {
	if (!guard) return;
	try {
		for (const change of guard.restore())
			console.log(`[desktop-e2e] registry put back: ${change.change} ${change.key}${change.name ? ` ${change.name}` : ''}`);
	} finally {
		guard.dispose();
	}
}
