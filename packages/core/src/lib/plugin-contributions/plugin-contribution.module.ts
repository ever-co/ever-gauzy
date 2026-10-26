import { Global, Module } from '@nestjs/common';
import {
	PluginFeatureRegistry,
	PluginPermissionRegistry,
	PluginSettingRegistry
} from './plugin-contribution.registry';

/**
 * Exposes the registries of what the loaded plugins contribute.
 *
 * The module is global because a contribution is consulted from several layers — the role guard,
 * the feature guard, the catalogue endpoints and any service that reads a declared setting — and
 * threading an import through every one of them would make a plugin's own declarations harder to
 * reach than the platform's built-in values.
 */
@Global()
@Module({
	providers: [PluginPermissionRegistry, PluginFeatureRegistry, PluginSettingRegistry],
	exports: [PluginPermissionRegistry, PluginFeatureRegistry, PluginSettingRegistry]
})
export class PluginContributionModule {}
