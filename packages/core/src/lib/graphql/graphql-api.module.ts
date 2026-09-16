import { DynamicModule, Module, Type } from '@nestjs/common';
import { getConfig } from '@gauzy/config';
import { getDynamicPluginsModules, getResolversFromPlugins } from '@gauzy/plugin';
import { RoleEntityResolver } from './../role/role-entity.resolver';

/**
 * Resolvers the platform itself ships.
 */
const CORE_RESOLVERS: Array<Type<any>> = [RoleEntityResolver];

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
			imports: getDynamicPluginsModules(),
			providers: resolvers,
			exports: resolvers
		};
	}
}
