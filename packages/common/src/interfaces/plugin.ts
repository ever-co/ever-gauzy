import { ModuleMetadata, Type } from '@nestjs/common';
import { APIExtensionDefinition } from './graphql';

export interface PluginMetaData extends ModuleMetadata {
	/**
	 * The plugin may define extensions
	 */
	extensions?: APIExtensionDefinition;

	/**
	 * The plugin may define microservice controllers
	 */
	microServices?: Type<any>[];

	/**
	 * The plugin may define injected entities
	 */
	entities?: Type<any>[];
}
