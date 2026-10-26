import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { getConfig } from '@gauzy/config';
import {
	PluginFeatureContribution,
	PluginPermissionContribution,
	PluginSettingContribution,
	getFeaturesFromPlugins,
	getPermissionsFromPlugins,
	getSettingsFromPlugins
} from '@gauzy/plugin';

/**
 * Registry of the permissions contributed by the plugins an installation has loaded.
 *
 * The platform's own permission values are a compiled enum, which a plugin cannot extend without
 * editing the platform. This registry lets a plugin declare the permissions it needs, and unions
 * them with the built-in catalogue at boot so that a role can be granted a contributed permission
 * exactly like a built-in one.
 *
 * A contributed value is an ordinary string by the time it reaches storage: role permission rows
 * hold the value, and the guard compares strings. The registry exists so that the catalogue, the
 * seeds and the administrative surface know which values are legitimate.
 */
@Injectable()
export class PluginPermissionRegistry implements OnModuleInit {
	private readonly logger = new Logger(PluginPermissionRegistry.name);
	private readonly contributions = new Map<string, PluginPermissionContribution>();

	/**
	 * Builds the registry from the configured plugin list.
	 */
	onModuleInit(): void {
		const contributions = getPermissionsFromPlugins(getConfig().plugins);

		for (const contribution of contributions) {
			if (!contribution?.value) {
				this.logger.warn('Ignoring a permission contribution that declares no value.');
				continue;
			}

			if (this.contributions.has(contribution.value)) {
				this.logger.warn(
					`Ignoring a duplicate permission contribution for "${contribution.value}". ` +
						'The first declaration wins.'
				);
				continue;
			}

			this.contributions.set(contribution.value, contribution);
		}

		if (this.contributions.size > 0) {
			this.logger.log(`Registered ${this.contributions.size} plugin-contributed permission(s).`);
		}
	}

	/**
	 * @returns Every contributed permission value.
	 */
	get values(): string[] {
		return [...this.contributions.keys()];
	}

	/**
	 * @returns Every contributed permission declaration.
	 */
	get all(): PluginPermissionContribution[] {
		return [...this.contributions.values()];
	}

	/**
	 * @param value A permission value to look up.
	 * @returns The declaration, or `undefined` when the value is not contributed by a plugin.
	 */
	find(value: string): PluginPermissionContribution | undefined {
		return this.contributions.get(value);
	}

	/**
	 * @param value A permission value to test.
	 * @returns True when a loaded plugin contributes the value.
	 */
	has(value: string): boolean {
		return this.contributions.has(value);
	}
}

/**
 * Registry of the feature flags contributed by the plugins an installation has loaded.
 *
 * A contributed feature starts disabled: loading a plugin must never change the behaviour of an
 * installation that has not asked for the capability. Enabling it is a per-tenant decision taken
 * through the ordinary feature toggle rows.
 */
@Injectable()
export class PluginFeatureRegistry implements OnModuleInit {
	private readonly logger = new Logger(PluginFeatureRegistry.name);
	private readonly contributions = new Map<string, PluginFeatureContribution>();

	/**
	 * Builds the registry from the configured plugin list.
	 */
	onModuleInit(): void {
		const contributions = getFeaturesFromPlugins(getConfig().plugins);

		for (const contribution of contributions) {
			if (!contribution?.code) {
				this.logger.warn('Ignoring a feature contribution that declares no code.');
				continue;
			}

			if (this.contributions.has(contribution.code)) {
				this.logger.warn(
					`Ignoring a duplicate feature contribution for "${contribution.code}". ` +
						'The first declaration wins.'
				);
				continue;
			}

			this.contributions.set(contribution.code, contribution);
		}

		if (this.contributions.size > 0) {
			this.logger.log(`Registered ${this.contributions.size} plugin-contributed feature(s).`);
		}
	}

	/**
	 * @returns Every contributed feature code.
	 */
	get codes(): string[] {
		return [...this.contributions.keys()];
	}

	/**
	 * @returns Every contributed feature declaration.
	 */
	get all(): PluginFeatureContribution[] {
		return [...this.contributions.values()];
	}

	/**
	 * @param code A feature code to look up.
	 * @returns The declaration, or `undefined` when the code is not contributed by a plugin.
	 */
	find(code: string): PluginFeatureContribution | undefined {
		return this.contributions.get(code);
	}

	/**
	 * Validates the dependency graph a set of contributed features declares.
	 *
	 * A feature that requires another feature which is neither built in nor contributed is a
	 * configuration mistake that would otherwise surface as a missing capability at request time.
	 *
	 * @param builtInCodes Feature codes the platform ships with.
	 * @returns The codes whose declared dependency cannot be satisfied.
	 */
	findUnsatisfiedDependencies(builtInCodes: string[]): Array<{ code: string; missing: string[] }> {
		const known = new Set([...builtInCodes, ...this.contributions.keys()]);
		const unsatisfied: Array<{ code: string; missing: string[] }> = [];

		for (const contribution of this.contributions.values()) {
			const missing = (contribution.dependsOn ?? []).filter((code) => !known.has(code));
			if (missing.length > 0) {
				unsatisfied.push({ code: contribution.code, missing });
			}
		}

		return unsatisfied;
	}
}

/**
 * Registry of the settings declared by the plugins an installation has loaded.
 *
 * The declaration describes what a plugin reads; the value always comes from the platform settings
 * store, so an operator overrides any declared default without a code change.
 */
@Injectable()
export class PluginSettingRegistry implements OnModuleInit {
	private readonly logger = new Logger(PluginSettingRegistry.name);
	private readonly contributions = new Map<string, PluginSettingContribution>();

	/**
	 * Builds the registry from the configured plugin list.
	 */
	onModuleInit(): void {
		const contributions = getSettingsFromPlugins(getConfig().plugins);

		for (const contribution of contributions) {
			if (!contribution?.key) {
				this.logger.warn('Ignoring a setting contribution that declares no key.');
				continue;
			}

			if (this.contributions.has(contribution.key)) {
				this.logger.warn(
					`Two plugins declare the setting "${contribution.key}". ` +
						'The first declaration wins; give one of them a distinct key.'
				);
				continue;
			}

			this.contributions.set(contribution.key, contribution);
		}

		if (this.contributions.size > 0) {
			this.logger.log(`Registered ${this.contributions.size} plugin-declared setting(s).`);
		}
	}

	/**
	 * @returns Every declared setting key.
	 */
	get keys(): string[] {
		return [...this.contributions.keys()];
	}

	/**
	 * @returns Every declared setting.
	 */
	get all(): PluginSettingContribution[] {
		return [...this.contributions.values()];
	}

	/**
	 * @param key A setting key to look up.
	 * @returns The declaration, or `undefined` when no plugin declares the key.
	 */
	find(key: string): PluginSettingContribution | undefined {
		return this.contributions.get(key);
	}

	/**
	 * Decodes a stored value according to its declaration.
	 *
	 * @param key The setting key.
	 * @param raw The value as stored, or `undefined` when nothing is stored.
	 * @returns The decoded value, falling back to the declared default.
	 */
	decode(key: string, raw: string | undefined | null): unknown {
		const declaration = this.contributions.get(key);
		const fallback = declaration?.default;

		if (raw === undefined || raw === null || raw === '') {
			return fallback;
		}

		switch (declaration?.type) {
			case 'number':
				return Number(raw);
			case 'boolean':
				return raw === 'true' || raw === '1';
			case 'json':
				try {
					return JSON.parse(raw);
				} catch {
					this.logger.warn(`Setting "${key}" holds a value that is not valid JSON; using the default.`);
					return fallback;
				}
			case 'string[]':
				return raw
					.split(',')
					.map((entry) => entry.trim())
					.filter((entry) => entry.length > 0);
			default:
				return raw;
		}
	}
}
