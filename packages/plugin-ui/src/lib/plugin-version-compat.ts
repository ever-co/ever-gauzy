import type { PluginUiDefinition } from './plugin-ui.types';
import type { DependencyIssue } from './plugin-dependency-graph';

// ─── Semver Utilities ───────────────────────────────────────────────────────

/**
 * Parsed semver version.
 */
interface SemVer {
	major: number;
	minor: number;
	patch: number;
	/** Prerelease tag (e.g. 'alpha', 'beta.1'). Undefined for release versions. */
	prerelease?: string;
}

/**
 * Parses a version string like '1.2.3' or '1.2.3-alpha.1' into a SemVer object.
 * Build metadata (after '+') is accepted but ignored per semver spec.
 * Returns null for invalid versions.
 */
export function parseSemVer(version: string): SemVer | null {
	const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+.*)?$/);
	if (!match) return null;
	return {
		major: parseInt(match[1], 10),
		minor: parseInt(match[2], 10),
		patch: parseInt(match[3], 10),
		prerelease: match[4] ?? undefined
	};
}

/**
 * Compares two semver versions.
 * Returns -1 (a < b), 0 (a == b), or 1 (a > b).
 *
 * Per semver spec: a prerelease version has lower precedence than
 * the same version without prerelease (e.g. 1.0.0-alpha < 1.0.0).
 */
export function compareSemVer(a: SemVer, b: SemVer): -1 | 0 | 1 {
	if (a.major !== b.major) return a.major < b.major ? -1 : 1;
	if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
	if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;

	// Both release → equal
	if (!a.prerelease && !b.prerelease) return 0;
	// Prerelease < release
	if (a.prerelease && !b.prerelease) return -1;
	if (!a.prerelease && b.prerelease) return 1;

	// Both have prerelease: compare dot-separated identifiers
	const aParts = a.prerelease!.split('.');
	const bParts = b.prerelease!.split('.');
	const len = Math.max(aParts.length, bParts.length);
	for (let i = 0; i < len; i++) {
		if (i >= aParts.length) return -1; // fewer identifiers → lower precedence
		if (i >= bParts.length) return 1;
		const aNum = /^\d+$/.test(aParts[i]) ? parseInt(aParts[i], 10) : NaN;
		const bNum = /^\d+$/.test(bParts[i]) ? parseInt(bParts[i], 10) : NaN;
		// Both numeric: compare as integers
		if (!isNaN(aNum) && !isNaN(bNum)) {
			if (aNum !== bNum) return aNum < bNum ? -1 : 1;
			continue;
		}
		// Numeric < string per semver spec
		if (!isNaN(aNum)) return -1;
		if (!isNaN(bNum)) return 1;
		// Both string: compare lexicographically
		if (aParts[i] < bParts[i]) return -1;
		if (aParts[i] > bParts[i]) return 1;
	}
	return 0;
}

/**
 * Checks if a version satisfies a range expression.
 *
 * Supported formats:
 * - `'*'` — any version
 * - `'^1.2.3'` — caret: ≥1.2.3 and <2.0.0 (compatible within major)
 * - `'~1.2.3'` — tilde: ≥1.2.3 and <1.3.0 (compatible within minor)
 * - `'>=1.2.3'` — at least 1.2.3
 * - `'>1.2.3'` — greater than 1.2.3
 * - `'1.2.3'` — exact match
 */
export function satisfies(version: string, range: string): boolean {
	const trimmed = range.trim();

	// Wildcard: any version
	if (trimmed === '*') return true;

	const ver = parseSemVer(version);
	if (!ver) return false;

	// Caret range: ^1.2.3
	if (trimmed.startsWith('^')) {
		const min = parseSemVer(trimmed.slice(1));
		if (!min) return false;
		if (ver.major !== min.major) return false;
		return compareSemVer(ver, min) >= 0;
	}

	// Tilde range: ~1.2.3
	if (trimmed.startsWith('~')) {
		const min = parseSemVer(trimmed.slice(1));
		if (!min) return false;
		if (ver.major !== min.major || ver.minor !== min.minor) return false;
		return ver.patch >= min.patch;
	}

	// Greater than or equal: >=1.2.3
	if (trimmed.startsWith('>=')) {
		const min = parseSemVer(trimmed.slice(2));
		if (!min) return false;
		return compareSemVer(ver, min) >= 0;
	}

	// Greater than: >1.2.3
	if (trimmed.startsWith('>')) {
		const min = parseSemVer(trimmed.slice(1));
		if (!min) return false;
		return compareSemVer(ver, min) > 0;
	}

	// Exact match: 1.2.3
	const exact = parseSemVer(trimmed);
	if (!exact) return false;
	return compareSemVer(ver, exact) === 0;
}

// ─── Compatibility Checker ──────────────────────────────────────────────────

/**
 * Result of plugin version compatibility check.
 */
export interface VersionCompatibilityResult {
	/** Whether all plugins are compatible. */
	compatible: boolean;
	/** Compatibility issues found. */
	issues: DependencyIssue[];
}

/**
 * Validates peer plugin version compatibility.
 *
 * Checks each plugin's `peerPlugins` requirements against the actual
 * versions declared in the plugin list.
 *
 * @example
 * ```ts
 * const plugins = flattenPlugins(config.plugins);
 * const result = checkVersionCompatibility(plugins);
 *
 * if (!result.compatible) {
 *   for (const issue of result.issues) {
 *     console.error(`[${issue.pluginId}] ${issue.message}`);
 *   }
 * }
 * ```
 *
 * @param plugins Flat list of plugin definitions.
 * @returns Compatibility check result.
 */
export function checkVersionCompatibility(plugins: PluginUiDefinition[]): VersionCompatibilityResult {
	const issues: DependencyIssue[] = [];
	const byId = new Map(plugins.map((p) => [p.id, p]));

	for (const plugin of plugins) {
		if (!plugin.peerPlugins) continue;

		for (const [peerId, range] of Object.entries(plugin.peerPlugins)) {
			const peer = byId.get(peerId);

			if (!peer) {
				issues.push({
					pluginId: plugin.id,
					severity: 'error',
					message: `Requires peer plugin '${peerId}' (${range}), but it is not registered.`,
					category: 'missing-dep'
				});
				continue;
			}

			if (range === '*') continue; // Any version is fine

			if (!peer.version) {
				issues.push({
					pluginId: plugin.id,
					severity: 'warning',
					message: `Requires peer '${peerId}' at ${range}, but '${peerId}' has no version declared. Cannot verify compatibility.`,
					category: 'missing-dep'
				});
				continue;
			}

			if (!satisfies(peer.version, range)) {
				issues.push({
					pluginId: plugin.id,
					severity: 'error',
					message: `Requires peer '${peerId}' at ${range}, but found version ${peer.version} — incompatible.`,
					category: 'missing-dep'
				});
			}
		}
	}

	return {
		compatible: issues.filter((i) => i.severity === 'error').length === 0,
		issues
	};
}
