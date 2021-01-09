import { Type } from '@nestjs/common';
import { DocumentNode } from 'graphql';

export interface GraphQLApiOptions {
	typePaths: string[];
	path: string;
	debug: boolean;
	playground: boolean | any;
	resolverModule: Function;
}

export interface APIExtensionDefinition {
	schema?: DocumentNode | (() => DocumentNode);
	resolvers: Array<Type<any>> | (() => Array<Type<any>>);
}
