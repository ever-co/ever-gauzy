import { Module } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import * as _ from 'underscore';
import {
	IOnPluginBootstrap,
	IOnPluginDestroy,
	IPluginMetaData
} from '@gauzy/common';
import { PLUGIN_METADATA } from './constants';

export interface OnDefaultPluginSeed {
	onDefaultPluginSeed(): void | Promise<void>;
}
export interface OnRandomPluginSeed {
	onRandomPluginSeed(): void | Promise<void>;
}

export function ExtensionPlugin(
	pluginMetadata: IPluginMetaData
): ClassDecorator {
	return (target) => {
		for (const metadataProperty of Object.values(PLUGIN_METADATA)) {
			const property = metadataProperty as keyof IPluginMetaData;
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

export type PluginLifecycleMethods = IOnPluginBootstrap &
	IOnPluginDestroy &
	OnDefaultPluginSeed &
	OnRandomPluginSeed;
