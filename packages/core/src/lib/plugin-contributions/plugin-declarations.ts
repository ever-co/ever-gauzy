import { getConfig } from '@gauzy/config';
import { PluginFeatureContribution, PluginPermissionContribution, getFeaturesFromPlugins, getPermissionsFromPlugins } from '@gauzy/plugin';

/**
 * Pure readers for what the configured plugins declare.
 *
 * A seed script and a migration run outside the Nest container, so they cannot inject a registry.
 * The registries used at request time are thin delegates over these functions, which keeps one
 * implementation of "what did the plugins declare" for both paths.
 */

/**
 * @returns Every permission value declared by a configured plugin, de-duplicated, first declaration
 * winning.
 */
export function getDeclaredPermissionValues(): string[] {
	const values = new Set<string>();

	for (const contribution of safePermissions()) {
		if (contribution?.value) {
			values.add(contribution.value);
		}
	}

	return [...values];
}

/**
 * @returns Every permission declaration from a configured plugin, de-duplicated by value.
 */
export function getDeclaredPermissions(): PluginPermissionContribution[] {
	const byValue = new Map<string, PluginPermissionContribution>();

	for (const contribution of safePermissions()) {
		if (contribution?.value && !byValue.has(contribution.value)) {
			byValue.set(contribution.value, contribution);
		}
	}

	return [...byValue.values()];
}

/**
 * @returns Every feature code declared by a configured plugin, de-duplicated.
 */
export function getDeclaredFeatureCodes(): string[] {
	const codes = new Set<string>();

	for (const contribution of safeFeatures()) {
		if (contribution?.code) {
			codes.add(contribution.code);
		}
	}

	return [...codes];
}

/**
 * @returns Every feature declaration from a configured plugin, de-duplicated by code.
 */
export function getDeclaredFeatures(): PluginFeatureContribution[] {
	const byCode = new Map<string, PluginFeatureContribution>();

	for (const contribution of safeFeatures()) {
		if (contribution?.code && !byCode.has(contribution.code)) {
			byCode.set(contribution.code, contribution);
		}
	}

	return [...byCode.values()];
}

/**
 * Reads the declared permissions without letting a plugin's malformed contribution break a seed.
 *
 * @returns The declarations, or an empty list when the configuration cannot be read.
 */
function safePermissions(): PluginPermissionContribution[] {
	try {
		return getPermissionsFromPlugins(getConfig()?.plugins ?? []);
	} catch {
		return [];
	}
}

/**
 * Reads the declared features without letting a plugin's malformed contribution break a seed.
 *
 * @returns The declarations, or an empty list when the configuration cannot be read.
 */
function safeFeatures(): PluginFeatureContribution[] {
	try {
		return getFeaturesFromPlugins(getConfig()?.plugins ?? []);
	} catch {
		return [];
	}
}
