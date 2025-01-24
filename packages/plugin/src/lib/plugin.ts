import { Module } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { pick } from 'underscore';
import { PluginMetadata } from './plugin.interface';
import { PLUGIN_METADATA } from './plugin-metadata';

/**
 * Decorator function for extending NestJS features with additional metadata.
 *
 * @param pluginMetadata Metadata to be applied to the target class.
 * @returns Class decorator function.
 */
export function GauzyCorePlugin(pluginMetadata: PluginMetadata): ClassDecorator {
	return (targetClass) => {
		// Iterate over properties in PLUGIN_METADATA
		for (const metadataProperty of Object.values(PLUGIN_METADATA)) {
			const property = metadataProperty as keyof PluginMetadata;

			// Check if the property exists in pluginMetadata and is not undefined
			if (property in pluginMetadata && pluginMetadata[property] !== undefined) {
				// Set metadata on the target class using Reflect
				Reflect.defineMetadata(property, pluginMetadata[property] || [], targetClass);
			}
		}

		// Pick relevant metadata from pluginMetadata based on MODULE_METADATA values
		const metadata = pick(pluginMetadata, Object.values(MODULE_METADATA) as string[]);

		// Apply the Module decorator with the picked metadata
		Module(metadata)(targetClass);
	};
}
