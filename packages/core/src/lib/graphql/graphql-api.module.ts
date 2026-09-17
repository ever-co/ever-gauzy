import { DynamicModule, Module, Type } from '@nestjs/common';
import { getConfig } from '@gauzy/config';
import { getDynamicPluginsModules, getResolversFromPlugins } from '@gauzy/plugin';
import { RoleEntityResolver } from './../role/role-entity.resolver';
import { RoleModule } from './../role/role.module';

/**
 * Resolvers the platform itself ships.
 *
 * `RoleEntityResolver` is declared by `RoleModule` — a resolver can only inject services its own
 * module can reach, so it belongs beside the service it calls — and is listed here as well so the
 * resolver is discovered from the module the Apollo configuration names, whichever way the resolver
 * graph is later rearranged.
 */
const CORE_RESOLVERS: Array<Type<any>> = [RoleEntityResolver];

/**
 * The domain modules that own the platform's core resolvers.
 *
 * Importing them is what makes their services injectable by the resolvers above: without this the
 * resolver graph would resolve, but the first resolver that asked for a domain service would fail
 * the boot with an unresolved dependency.
 */
const CORE_RESOLVER_MODULES: Array<Type<any>> = [RoleModule];

/**
 * Hosts the GraphQL resolvers.
 *
 * A resolver is an ordinary Nest provider, so it can only inject services its own module can reach.
 * The module therefore imports every plugin's module, which is what lets a resolver contributed by a
 * plugin ask for that plugin's services rather than reaching into the container. Plugin modules are
 * declared through the same helper the seeder uses, so a plugin declares its module once and both
 * the seeding graph and the resolver graph pick it up.
 *
 * The platform's Apollo configuration names this module as the one that hosts resolvers, so a class
 * contributed here is discovered without any further registration.
 */
@Module({})
export class GraphqlApiModule {
	/**
	 * Builds the resolver module for the plugins this installation has configured.
	 *
	 * @returns The dynamic module to import.
	 */
	static withPlugins(): DynamicModule {
		const pluginResolvers = getResolversFromPlugins(getConfig().plugins);
		const resolvers = [...CORE_RESOLVERS, ...pluginResolvers];

		return {
			module: GraphqlApiModule,
			imports: [...CORE_RESOLVER_MODULES, ...getDynamicPluginsModules()],
			providers: resolvers,
			exports: resolvers
		};
	}
}
