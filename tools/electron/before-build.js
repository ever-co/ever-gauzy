/**
 * electron-builder `beforeBuild` hook of the desktop apps: installs the packaged app's production dependencies into
 * its own directory (`dist/apps/<app>/node_modules`), as electron-builder 26.0 did by itself.
 *
 * Since 26.x electron-builder skips that install when the project directory, the app directory OR the workspace
 * root has a `node_modules` - and this workspace root always has one - and then packs the dependencies of the
 * workspace root instead of the app's own: a desktop-timer package built that way had none of `@gauzy/desktop-lib`,
 * `knex`, `electron-store` or `better-sqlite3`, so it could not start. With the app's own tree in place,
 * electron-builder rebuilds its native modules for Electron (`npmRebuild`) and packs exactly that tree.
 *
 * The install mirrors electron-builder 26.0's: the package manager that runs the build (yarn), with the environment
 * that makes native modules build for Electron. Yarn, not npm: npm refuses the app's dependency set over a peer range
 * (`@datorama/akita` pins `tslib` 2.4.1).
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/** The environment electron-builder 26.0 installed with (its `getGypEnv`), so install scripts target Electron. */
function electronInstallEnv({ electronVersion, platform, arch }) {
	const npmArch = arch === 'armv7l' ? 'arm' : arch;
	let env = {
		...process.env,
		npm_config_arch: npmArch,
		npm_config_target_arch: npmArch,
		npm_config_platform: platform,
		npm_config_target_platform: platform,
		npm_config_build_from_source: 'false',
		npm_config_update_binary: 'true',
		npm_config_fallback_to_build: 'true',
		npm_config_disturl: process.env.npm_config_electron_mirror || 'https://electronjs.org/headers',
		npm_config_target: electronVersion,
		npm_config_runtime: 'electron',
		npm_config_devdir: path.join(os.homedir(), '.electron-gyp')
	};
	if (platform !== process.platform) env.npm_config_force = 'true';
	if (platform === 'win32' || platform === 'darwin') env.npm_config_target_libc = 'unknown';
	return env;
}

/** Yarn as the build runs it (`yarn electron-builder ...` sets npm_execpath), else the `yarn` on PATH. */
function yarnCommand() {
	const execPath = process.env.npm_execpath;
	if (execPath && /yarn/i.test(path.basename(execPath))) {
		return { command: process.env.npm_node_execpath || process.execPath, prefix: [execPath], shell: false };
	}
	return { command: 'yarn', prefix: [], shell: process.platform === 'win32' };
}

exports.default = async function beforeBuild({ appDir, electronVersion, platform, arch }) {
	// Already installed (a re-run on the same dist): electron-builder 26.0 rebuilt it in place, so do we.
	if (fs.existsSync(path.join(appDir, 'node_modules'))) {
		return true;
	}
	const { command, prefix, shell } = yarnCommand();
	// --ignore-engines: `engines` would be checked against the Node that runs the build, while these modules run in
	// Electron's own Node (node-notifier 11, say, refuses a build machine on Node 24.14).
	const args = [
		...prefix,
		'install',
		'--production',
		'--non-interactive',
		'--ignore-engines',
		'--network-timeout',
		'600000'
	];
	console.log(`  • installing production dependencies of the app  appDir=${appDir} electron=${electronVersion}`);
	const result = spawnSync(command, args, {
		cwd: appDir,
		env: electronInstallEnv({ electronVersion, platform, arch }),
		stdio: 'inherit',
		shell
	});
	if (result.error) throw result.error;
	if (result.status !== 0) {
		throw new Error(`Installing the production dependencies of ${appDir} failed (exit code ${result.status})`);
	}
	// true: electron-builder goes on to rebuild the native modules of this tree for Electron, then packs it.
	return true;
};
