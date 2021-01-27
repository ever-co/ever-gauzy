import { ModuleMetadata, Type } from '@nestjs/common';
import { IAPIExtensionDefinition } from './IGraphql';

export interface IPluginMetaData extends ModuleMetadata {
	/**
	 * The plugin may define extensions
	 */
	extensions?: IAPIExtensionDefinition;

	/**
	 * The plugin may define microservice controllers
	 */
	microServices?: Type<any>[];

	/**
	 * The plugin may define injected entities
	 */
	entities?: Type<any>[];
}
