import { Type } from '@nestjs/common';
import { DocumentNode } from 'graphql';

export interface IGraphQLApiOptions {
	typePaths: string[];
	path: string;
	debug: boolean;
	playground: boolean | any;
	resolverModule: Function;
}

export interface IAPIExtensionDefinition {
	schema?: DocumentNode | (() => DocumentNode);
	resolvers?: Array<Type<any>> | (() => Array<Type<any>>);
}
