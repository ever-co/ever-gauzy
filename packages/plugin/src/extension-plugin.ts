import { Module } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import * as _ from 'underscore';
import {
	OnPluginBootstrap,
	OnPluginDestroy,
	PluginMetaData
} from '@gauzy/common';
import { PLUGIN_METADATA } from './constants';

export function ExtensionPlugin(
	pluginMetadata: PluginMetaData
): ClassDecorator {
	return (target) => {
		for (const metadataProperty of Object.values(PLUGIN_METADATA)) {
			const property = metadataProperty as keyof PluginMetaData;
			if (property in pluginMetadata && property !== null) {
				Reflect.defineMetadata(
					property,
					pluginMetadata[property],
					target
				);
			}
		}
		const metadata = _.pick(
			pluginMetadata,
			Object.values(MODULE_METADATA) as string[]
		);
		Module(metadata)(target);
	};
}

export type PluginLifecycleMethods = OnPluginBootstrap & OnPluginDestroy;
