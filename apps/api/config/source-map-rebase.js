const path = require('node:path');

/**
 * Source maps of the compiled `@gauzy/*` packages, rebased for the copies the API and worker builds make.
 *
 * `tsc` writes each package's maps next to its output in `dist/packages/<package>/...`, with sources relative to
 * that place (`../../../../../../packages/core/src/lib/bootstrap/index.ts`). The builds then copy every package to
 * `dist/apps/<app>/node_modules/@gauzy/<package>/...` (see `webpack-package-copy-patterns.js`), which is deeper in the
 * tree, so the same relative source resolves under `dist/apps/<app>/` instead of the workspace root: the file does not
 * exist, breakpoints in the packages' sources never bind, and stack traces point nowhere (ever-co/ever-gauzy#9573).
 * Rewriting the relative sources of each copied map for its new directory makes them resolve to the real sources
 * again, for every debugger and for `source-map-support` stack traces alike.
 */

/** The extension of the files this rebases. */
const SOURCE_MAP_EXTENSION = '.map';

/**
 * Whether a `sources` / `sourceRoot` entry is a path relative to the map, i.e. one that moving the map changes.
 * URLs (`webpack://`, `file://`, `https://`) and absolute paths (POSIX or Windows) resolve the same from anywhere and
 * are left alone.
 *
 * @param {unknown} value - A `sources` entry or the `sourceRoot` of a source map.
 * @returns {boolean} True for a non-empty relative path.
 */
function isRelativeSourcePath(value) {
	return (
		typeof value === 'string' &&
		value !== '' &&
		!value.startsWith('/') &&
		!path.isAbsolute(value) &&
		!/^[a-z][a-z\d+.-]*:/i.test(value)
	);
}

/**
 * Rewrites the relative sources of a source map that moves from `fromDir` to `toDir`, so that every source still
 * resolves to the same file. A relative `sourceRoot` is folded into the sources (and cleared); everything else in the
 * map (mappings, names, sourcesContent, absolute or URL sources) is kept as it is.
 *
 * @param {string} json - The source map, as JSON text.
 * @param {string} fromDir - The directory the map was written in.
 * @param {string} toDir - The directory the map is copied to.
 * @returns {string|null} The rewritten map, or null when it needs no change or is not a source map.
 */
function rebaseSourceMap(json, fromDir, toDir) {
	let map;
	try {
		map = JSON.parse(json);
	} catch {
		return null;
	}
	if (!map || typeof map !== 'object' || !Array.isArray(map.sources)) {
		return null;
	}

	const sourceRoot = map.sourceRoot ?? '';
	if (sourceRoot !== '' && !isRelativeSourcePath(sourceRoot)) {
		// An absolute or URL source root makes every source independent of where the map lives.
		return null;
	}

	let changed = sourceRoot !== '';
	const sources = map.sources.map((source) => {
		if (!isRelativeSourcePath(source)) {
			return source;
		}
		const absolute = path.resolve(fromDir, sourceRoot, source);
		const rebased = path.relative(toDir, absolute).split(path.sep).join('/');
		changed ||= rebased !== source;
		return rebased;
	});

	if (!changed) {
		return null;
	}
	return JSON.stringify({ ...map, ...(sourceRoot !== '' && { sourceRoot: '' }), sources });
}

/**
 * Builds the CopyWebpackPlugin `transform` that rebases every source map copied from `fromRoot` to `toRoot`. Other
 * files, and any map it cannot read, pass through untouched: the transform never fails a build.
 *
 * @param {string} fromRoot - The package directory being copied (`dist/packages/<package>`).
 * @param {string} toRoot - Where the package is copied (`dist/apps/<app>/node_modules/@gauzy/<package>`).
 * @returns {(content: Buffer|string, absoluteFrom: string) => Buffer|string} The transform.
 */
function sourceMapRebaseTransform(fromRoot, toRoot) {
	return (content, absoluteFrom) => {
		if (!absoluteFrom.endsWith(SOURCE_MAP_EXTENSION)) {
			return content;
		}
		const fromDir = path.dirname(absoluteFrom);
		const toDir = path.join(toRoot, path.relative(fromRoot, fromDir));
		return rebaseSourceMap(content.toString(), fromDir, toDir) ?? content;
	};
}

module.exports = { isRelativeSourcePath, rebaseSourceMap, sourceMapRebaseTransform };
