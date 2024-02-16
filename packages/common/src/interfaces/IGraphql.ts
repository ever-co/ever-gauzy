import { Type } from '@nestjs/common';
import { DocumentNode } from 'graphql';

/**
 * Configuration options for a GraphQL API in NestJS.
 */
export interface GraphQLApiConfigurationOptions {
	/**
	 * An array of file paths or glob patterns that specify the GraphQL schema types.
	 */
	typePaths: string[];

	/**
	 * The path where the GraphQL API will be accessible.
	 */
	path: string;

	/**
	 * A boolean indicating whether debugging should be enabled for the GraphQL API.
	 */
	debug: boolean;

	/**
	 * A boolean indicating whether the GraphQL Playground should be enabled.
	 */
	playground: boolean | any;

	/**
	 * The module containing resolvers for the GraphQL API.
	 */
	resolverModule: Function;
}

/**
 * Configuration options for extensions provided by an API in NestJS.
 */
export interface ExtensionConfigurationOptions {
	/**
	 * The GraphQL schema or a function returning the schema.
	 */
	schema?: DocumentNode | (() => DocumentNode);

	/**
	 * An array of resolver classes or a function returning an array of resolver classes.
	 */
	resolvers?: Array<Type<any>> | (() => Array<Type<any>>);
}
