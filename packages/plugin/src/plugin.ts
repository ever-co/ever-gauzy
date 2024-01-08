import { Module } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { pick } from 'underscore';
import { IPluginMetaData } from './plugin.interface';
import { PLUGIN_METADATA } from './plugin-metadata';

/**
 * Decorator to apply core plugin metadata to a class.
 * @param pluginMetadata The metadata to be applied to the class.
 * @returns The decorated class.
 */
export function CorePlugin(
	pluginMetadata: IPluginMetaData
): ClassDecorator {
	return (targetClass) => {
		for (const metadataProperty of Object.values(PLUGIN_METADATA)) {
			const property = metadataProperty as keyof IPluginMetaData;
			if (property in pluginMetadata && pluginMetadata[property] !== undefined) {
				Reflect.defineMetadata(property, pluginMetadata[property] || [], targetClass);
			}
		}
		const metadata = pick(pluginMetadata, Object.values(MODULE_METADATA) as string[]);
		Module(metadata)(targetClass);
	};
}
