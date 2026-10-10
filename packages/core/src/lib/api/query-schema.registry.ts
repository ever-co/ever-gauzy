import { DynamicModule, Type } from '@nestjs/common';
import { getApiQuerySchemasFromPlugins } from '@gauzy/plugin';
import { ApiQuerySchema, isApiQuerySchema } from './query-schema';
import * as coreQuerySchemaModule from './query-schemas';

/**
 * Where resource query schemas are collected from.
 *
 * The declarations are spread across the packages that own the resources — one beside each
 * controller, plus whatever a plugin contributes — and two consumers need the whole set: the
 * request pipe, which validates a query against the declaration of the resource being read, and the
 * GraphQL input generator, which projects every declaration into filter, sort and pagination types.
 *
 * The registry is deliberately a plain object with a `Map` in it rather than a Nest provider. The
 * generator runs outside a container, and a declaration that only exists once a module has been
 * instantiated would be invisible to a build step — and to a test.
 */

/**
 * Reads the core declarations out of the barrel.
 *
 * The barrel is imported as a module rather than through a list of names so that adding a schema to
 * it is the only edit a resource has to make here; nothing in this file names a resource.
 *
 * @returns Every schema the core barrel exports, in the barrel's order.
 */
export function collectCoreApiQuerySchemas(): ApiQuerySchema[] {
	return Object.values(coreQuerySchemaModule as Record<string, unknown>).filter(isApiQuerySchema);
}

/**
 * Collects the core declarations and every declaration a plugin contributes.
 *
 * @param plugins The configured plugin list, when the caller has one.
 * @returns The schemas, core first and plugins after, in declaration order.
 */
export function collectApiQuerySchemas(
	plugins?: Array<Type<any> | DynamicModule>
): ApiQuerySchema[] {
	const contributed = getApiQuerySchemasFromPlugins(plugins).filter(isApiQuerySchema) as ApiQuerySchema[];
	return [...collectCoreApiQuerySchemas(), ...contributed];
}

/**
 * The set of resource query schemas.
 *
 * A duplicate resource name is a bug rather than a merge: two declarations for one concept would
 * mean two answers to "may this be filtered", and the answer a caller got would depend on which one
 * happened to be read first. Registration therefore refuses the second declaration and names the
 * resource, at bootstrap, where it is cheap to fix.
 */
export class ApiQuerySchemaRegistry {
	private readonly schemas = new Map<string, ApiQuerySchema>();

	/**
	 * Registers one declaration.
	 *
	 * @param schema The declaration.
	 * @returns The registered declaration, so registrations can be chained or collected in place.
	 * @throws Error when a declaration for the same resource is already registered.
	 */
	register(schema: ApiQuerySchema): ApiQuerySchema {
		if (this.schemas.has(schema.resource)) {
			throw new Error(`API query schema "${schema.resource}" is declared twice`);
		}
		this.schemas.set(schema.resource, schema);
		return schema;
	}

	/**
	 * Registers a list of declarations.
	 *
	 * @param schemas The declarations.
	 * @returns This registry.
	 */
	registerAll(schemas: readonly ApiQuerySchema[]): this {
		for (const schema of schemas) {
			this.register(schema);
		}
		return this;
	}

	/**
	 * Reads one declaration back.
	 *
	 * @param resource The concept root word.
	 * @returns The declaration, or `undefined` when the resource declares none — which is the
	 *   signal that the resource has not adopted the query protocol.
	 */
	get(resource: string): ApiQuerySchema | undefined {
		return this.schemas.get(resource);
	}

	/**
	 * Whether a resource declares a schema.
	 *
	 * @param resource The concept root word.
	 */
	has(resource: string): boolean {
		return this.schemas.has(resource);
	}

	/**
	 * Every declaration, in registration order.
	 *
	 * @returns The declarations.
	 */
	getAll(): ApiQuerySchema[] {
		return Array.from(this.schemas.values());
	}

	/** How many resources have adopted the protocol. */
	get size(): number {
		return this.schemas.size;
	}
}

/**
 * Builds a registry over the core declarations and the configured plugins.
 *
 * @param plugins The configured plugin list, when the caller has one.
 * @returns A registry holding every declaration, or throws when two of them name one resource.
 */
export function createApiQuerySchemaRegistry(
	plugins?: Array<Type<any> | DynamicModule>
): ApiQuerySchemaRegistry {
	return new ApiQuerySchemaRegistry().registerAll(collectApiQuerySchemas(plugins));
}
