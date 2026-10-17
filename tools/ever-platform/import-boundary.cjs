// cspell:words posthog
/**
 * The import boundary of the optional Ever Platform modules, in one place for two readers: the
 * ESLint rule `ever-platform/import-boundary` (root `eslint.config.js`, so editors and `nx lint`
 * show it) and `check-import-boundary.mjs` (the CI gate, which needs no workspace install).
 *
 * - Only the modules themselves and the two plugin lists (the API's and the web app's) import a
 *   module (`@gauzy/plugin-ever-*`), and only through its public entry point: no core code depends
 *   on a module, so switching one off removes it whole.
 * - The statistics never import the connection or an analytics plugin; the instance identity makes
 *   no request and depends on neither module; the connection and the Ever ID sign-in plugin never
 *   import each other; a web part never imports a server part.
 * - Nothing outside the connection reads an entitlement document: its entry point exports no
 *   entitlement code.
 */
'use strict';

const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** The module packages (`packages/plugins/<name>`) and their package names. */
const MODULES = ['ever-connect', 'ever-connect-ui', 'ever-stats', 'ever-stats-ui', 'ever-instance'];
const SERVER_MODULES = ['ever-connect', 'ever-stats', 'ever-instance'];
const pkg = (name) => `@gauzy/plugin-${name}`;

/** The plugin lists: the only files outside the modules that import them. */
const PLUGIN_LISTS = ['apps/api/src/plugins.ts', 'apps/gauzy/src/plugin-ui.config.ts'];

const ANALYTICS = ['@gauzy/plugin-jitsu-analytics', '@gauzy/plugin-posthog'];
const HTTP_CLIENTS = ['@nestjs/axios', 'axios', 'undici'];

/** The package directory a repository path is in (`packages/plugins/<name>`), or null. */
function pluginOf(file) {
	const match = /^packages\/plugins\/([^/]+)\//.exec(file);
	return match ? match[1] : null;
}

/** `name` or a subpath of it. */
const isPackage = (specifier, name) => specifier === name || specifier.startsWith(`${name}/`);
const anyOf = (specifier, names) => names.find((name) => isPackage(specifier, name)) ?? null;

/** The Ever Platform module a specifier names (`ever-connect`), or null. */
function moduleOf(specifier) {
	const match = /^@gauzy\/plugin-(ever-[a-z0-9-]+)(\/.*)?$/.exec(specifier);
	return match && MODULES.includes(match[1]) ? match[1] : null;
}

/**
 * Why `file` (a repository path with forward slashes) may not import `specifier`, or null.
 */
function violation(file, specifier) {
	const from = pluginOf(file);
	const target = moduleOf(specifier);

	if (target) {
		if (!MODULES.includes(from ?? '') && !PLUGIN_LISTS.includes(file)) {
			return `${specifier} is an optional Ever Platform module: only the modules and the plugin lists (${PLUGIN_LISTS.join(', ')}) import it, so switching it off removes it whole`;
		}
		if (specifier !== pkg(target) && from !== target) {
			return `${specifier}: import a module through its entry point (${pkg(target)}), never its files`;
		}
	}

	if (from === 'ever-stats' || from === 'ever-stats-ui') {
		const hit = anyOf(specifier, [pkg('ever-connect'), pkg('ever-connect-ui'), ...ANALYTICS]);
		if (hit)
			return `${hit}: the anonymous statistics are independent of the connection and of every analytics plugin`;
	}
	if (from === 'ever-instance') {
		const hit = anyOf(specifier, [pkg('ever-connect'), pkg('ever-stats'), ...ANALYTICS, ...HTTP_CLIENTS]);
		if (hit) return `${hit}: the instance identity makes no request and depends on neither module`;
	}
	if (from === 'ever-connect' && /^@gauzy\/plugin-auth-zitadel/.test(specifier)) {
		return `${specifier}: the connection and the Ever ID sign-in plugin never import each other`;
	}
	if (from && from.startsWith('auth-zitadel') && isPackage(specifier, pkg('ever-connect'))) {
		return `${specifier}: the Ever ID sign-in plugin and the connection never import each other`;
	}
	if ((from === 'ever-connect-ui' || from === 'ever-stats-ui') && target && SERVER_MODULES.includes(target)) {
		return `${specifier}: a web part never imports a server module`;
	}
	return null;
}

/** The connection's entry point: it exports no entitlement code. */
const CONNECT_ENTRY = 'packages/plugins/ever-connect/src/index.ts';

function exportViolation(file, source) {
	if (file === CONNECT_ENTRY && /entitlement/i.test(source)) {
		return `${source}: nothing outside the connection reads an entitlement document, so its entry point does not export the entitlement code`;
	}
	return null;
}

/** The known-bad fixtures of the boundary's test: never checked as part of the tree. */
const FIXTURES = 'tools/ever-platform/fixtures/';

/** A repository path (forward slashes) for an absolute or relative file name, or null outside it. */
function repoPath(filename) {
	const rel = path.relative(REPO_ROOT, path.resolve(filename)).split(path.sep).join('/');
	return rel.startsWith('..') ? null : rel;
}

const rule = {
	meta: {
		type: 'problem',
		docs: {
			description:
				'The import boundary of the optional Ever Platform modules (tools/ever-platform/import-boundary.cjs)'
		},
		schema: []
	},
	create(context) {
		const file = repoPath(context.filename ?? context.getFilename());
		if (!file || file.startsWith(FIXTURES)) return {};
		const report = (node, message) => context.report({ node, message });
		const check = (node, source) => {
			if (typeof source !== 'string') return;
			const message = violation(file, source);
			if (message) report(node, message);
		};
		const checkExport = (node) => {
			if (!node.source) return;
			check(node.source, node.source.value);
			const message = exportViolation(file, node.source.value);
			if (message) report(node.source, message);
		};
		return {
			ImportDeclaration: (node) => check(node.source, node.source.value),
			ImportExpression: (node) => node.source.type === 'Literal' && check(node.source, node.source.value),
			TSImportEqualsDeclaration: (node) =>
				node.moduleReference?.type === 'TSExternalModuleReference' &&
				check(node.moduleReference.expression, node.moduleReference.expression.value),
			ExportAllDeclaration: checkExport,
			ExportNamedDeclaration: checkExport,
			CallExpression: (node) => {
				if (
					node.callee.type === 'Identifier' &&
					node.callee.name === 'require' &&
					node.arguments[0]?.type === 'Literal'
				) {
					check(node.arguments[0], node.arguments[0].value);
				}
			}
		};
	}
};

const plugin = { meta: { name: 'ever-platform' }, rules: { 'import-boundary': rule } };

module.exports = { FIXTURES, MODULES, PLUGIN_LISTS, CONNECT_ENTRY, violation, exportViolation, repoPath, plugin };
