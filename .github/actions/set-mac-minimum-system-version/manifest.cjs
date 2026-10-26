'use strict';

/**
 * Pure helpers for the set-mac-minimum-system-version action: the text edit of latest-mac.yml and the
 * resolution of the release it belongs to. No I/O here, so `node --test` can cover every branch.
 */

const KEY = 'minimumSystemVersion';
const VERSION = /^\d+\.\d+\.\d+$/;
const TAG = /^v\d+\.\d+\.\d+$/;

/**
 * Compares two X.Y.Z versions numerically.
 *
 * @returns A negative number, zero or a positive number as `a` is lower than, equal to or higher than `b`.
 */
function compareVersions(a, b) {
	const left = a.split('.').map(Number);
	const right = b.split('.').map(Number);
	for (let i = 0; i < 3; i++) {
		if (left[i] !== right[i]) return left[i] - right[i];
	}
	return 0;
}

/** Throws unless `minimum` is an X.Y.Z Darwin version. */
function assertMinimum(minimum) {
	if (typeof minimum !== 'string' || !VERSION.test(minimum)) {
		throw new Error(`The minimum system version must be a Darwin version X.Y.Z (got '${minimum}').`);
	}
}

/** The scalar value of a YAML line's value part: surrounding quotes and a trailing comment removed. */
function scalarOf(raw) {
	const value = raw.trim();
	const quoted = /^(['"])(.*?)\1(\s+#.*)?$/.exec(value);
	if (quoted) return quoted[2];
	return value.replace(/\s+#.*$/, '').trim();
}

/**
 * Makes latest-mac.yml declare `minimumSystemVersion` of at least `minimum`, as a top-level key, and
 * leaves every other byte of the file as it was.
 *
 * electron-updater (AppUpdater.checkIfUpdateSupported) skips an update when
 * `semver.lt(os.release(), minimumSystemVersion)`. os.release() is the Darwin kernel version, so the
 * value is a Darwin version (macOS 13 = 22.0.0), not a macOS one. A value semver cannot read (e.g. a
 * macOS-style "13.0") only makes electron-updater log a warning and offer the update anyway, so it is
 * replaced rather than kept.
 *
 * @param text The manifest as published by electron-builder.
 * @param minimum The Darwin version to require, X.Y.Z.
 * @returns `{ text, changed, previous }`: the new text (the input itself when unchanged), whether it
 *          changed, and the value the manifest declared before (null when it declared none).
 */
function ensureMinimumSystemVersion(text, minimum) {
	assertMinimum(minimum);
	if (typeof text !== 'string' || !/^version:/m.test(text) || !/^files:/m.test(text)) {
		throw new Error('This does not look like an electron-builder update manifest (no top-level version: and files: keys).');
	}
	// A line appended after a document marker would land in a second document, which electron-updater
	// refuses to load. electron-builder never writes one; refuse rather than guess.
	if (/^(---|\.\.\.)\s*$/m.test(text)) {
		throw new Error('The manifest contains a YAML document marker (--- or ...); refusing to edit it.');
	}

	const lines = [...text.matchAll(new RegExp(`^${KEY}:(.*)$`, 'gm'))];
	if (lines.length > 1) {
		throw new Error(`The manifest declares ${KEY} ${lines.length} times.`);
	}

	if (lines.length === 1) {
		const [line, rawValue] = lines[0];
		const previous = scalarOf(rawValue.replace(/\r$/, ''));
		if (VERSION.test(previous) && compareVersions(previous, minimum) >= 0) {
			return { text, changed: false, previous };
		}
		const replacement = `${KEY}: ${minimum}${line.endsWith('\r') ? '\r' : ''}`;
		const at = lines[0].index;
		return {
			text: text.slice(0, at) + replacement + text.slice(at + line.length),
			changed: true,
			previous
		};
	}

	const eol = text.includes('\r\n') ? '\r\n' : '\n';
	const separator = text.endsWith('\n') ? '' : eol;
	return { text: `${text}${separator}${KEY}: ${minimum}${eol}`, changed: true, previous: null };
}

/**
 * Resolves the release electron-builder published to.
 *
 * electron-builder publishes to `v<version>` (vPrefixedTagName) of the app package the bump step wrote,
 * in the repository its github publish entry names. The caller passes the tag the gate resolved and the
 * owner/repo it gave the bump step; the package, when given, both fills an empty tag (an ad-hoc 'temp'
 * push still publishes: the bump step falls back to another tag) and catches a caller whose values have
 * drifted from what was actually published.
 *
 * @param inputs `{ owner, repo, tag, appPackage }`; `appPackage` is the parsed package.json or null.
 * @returns `{ owner, repo, tag }`, or `{ skip: reason }` when nothing names a release.
 */
function resolveTarget({ owner, repo, tag, appPackage }) {
	if (!owner || !repo) {
		throw new Error('Both the owner and the repo of the release repository are required.');
	}
	let resolvedTag = (tag || '').trim();
	if (appPackage) {
		const publishTag = appPackage.version ? `v${appPackage.version}` : '';
		if (!resolvedTag) {
			resolvedTag = publishTag;
		} else if (publishTag && publishTag !== resolvedTag) {
			throw new Error(`The tag '${resolvedTag}' is not the one electron-builder published to: the app package is version ${appPackage.version} (${publishTag}).`);
		}
		const publish = [].concat(appPackage.build?.publish ?? []).find((entry) => entry?.provider === 'github');
		const differs = (a, b) => a && b && a.toLowerCase() !== b.toLowerCase();
		if (publish && (differs(publish.owner, owner) || differs(publish.repo, repo))) {
			throw new Error(`The release repository ${owner}/${repo} is not the one electron-builder published to (${publish.owner}/${publish.repo}).`);
		}
	}
	if (!resolvedTag) {
		return { skip: 'No release tag was given and none could be derived from the app package; nothing was published.' };
	}
	if (!TAG.test(resolvedTag)) {
		throw new Error(`'${resolvedTag}' is not a vX.Y.Z release tag.`);
	}
	return { owner, repo, tag: resolvedTag };
}

module.exports = { KEY, assertMinimum, compareVersions, ensureMinimumSystemVersion, resolveTarget };
