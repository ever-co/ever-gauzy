import { DynamicModule, Module, Type } from '@nestjs/common';
import { getConfig } from '@gauzy/config';
import { getDynamicPluginsModules, getResolversFromPlugins } from '@gauzy/plugin';
import { RoleEntityResolver } from './../role/role-entity.resolver';
import { RoleModule } from './../role/role.module';
import { RolePermissionModule } from './../role-permission/role-permission.module';
import { UnitCategoryResolver } from './../measurement/unit-category.resolver';
import { UnitResolver } from './../measurement/unit.resolver';
import { MeasurementModule } from './../measurement/measurement.module';
import { PaymentTermResolver } from './../payment-term/payment-term.resolver';
import { PaymentTermModule } from './../payment-term/payment-term.module';
import { AddressRoleResolver } from './../address-role/address-role.resolver';
import { AddressRoleModule } from './../address-role/address-role.module';
import { GraphqlSubscriptionModule } from './subscriptions/graphql-subscription.module';
import { ChannelResolver } from './../channel/channel.resolver';
import { ChannelDomainResolver } from './../channel-domain/channel-domain.resolver';
import { RegionResolver } from './../region/region.resolver';
import { ChannelModule } from './../channel/channel.module';
import { AddressResolver } from './../address/address.resolver';
import { AddressModule } from './../address/address.module';
import { ContactGroupResolver } from './../contact-group/contact-group.resolver';
import { ContactGroupModule } from './../contact-group/contact-group.module';
import { ContactGroupMemberResolver } from './../contact-group-member/contact-group-member.resolver';
import { ContactGroupMemberModule } from './../contact-group-member/contact-group-member.module';
import { ContactCredentialResolver } from './../contact-credential/contact-credential.resolver';
import { ContactCredentialModule } from './../contact-credential/contact-credential.module';
import { ContactBuyerResolver } from './../contact-buyer/contact-buyer.resolver';
import { ContactBuyerModule } from './../contact-buyer/contact-buyer.module';

/**
 * Resolvers the platform itself ships.
 *
 * `RoleEntityResolver` is declared by `RoleModule` — a resolver can only inject services its own
 * module can reach, so it belongs beside the service it calls — and is listed here as well so the
 * resolver is discovered from the module the Apollo configuration names, whichever way the resolver
 * graph is later rearranged. The measurement, settlement-term, address-role and multi-channel kernel
 * resolvers follow the same rule: each is declared by the module that owns its service.
 */
const CORE_RESOLVERS: Array<Type<any>> = [
	RoleEntityResolver,
	UnitCategoryResolver,
	UnitResolver,
	PaymentTermResolver,
	AddressRoleResolver,
	// The multi-channel, multi-region kernel. All three resolvers are declared by `ChannelModule`,
	// because one module provides the five services they call; they are listed here so Apollo finds
	// them from the module its configuration names.
	ChannelResolver,
	ChannelDomainResolver,
	RegionResolver,
	// The party-data kernel. Each resolver is declared by the domain module that owns the service it
	// calls: the address book, the group, the membership pivot (whose resolver is attached to the
	// group type because the membership has no root of its own), the login and the company account.
	AddressResolver,
	ContactGroupResolver,
	ContactGroupMemberResolver,
	ContactCredentialResolver,
	ContactBuyerResolver
];

/**
 * The domain modules that own the platform's core resolvers.
 *
 * Importing them is what makes their services injectable by the resolvers above: without this the
 * resolver graph would resolve, but the first resolver that asked for a domain service would fail
 * the boot with an unresolved dependency.
 *
 * `RolePermissionModule` is imported for the guards rather than for a resolver. A guard is a
 * provider of whichever module hosts the handler it protects, so the permission guard that every
 * resolver here carries resolves its permission lookup from *this* module — exporting the service
 * from the module that happens to own it is not enough, the module has to be imported.
 */
const CORE_RESOLVER_MODULES: Array<Type<any>> = [
	RoleModule,
	RolePermissionModule,
	MeasurementModule,
	PaymentTermModule,
	AddressRoleModule,
	// One module for the whole kernel domain: it provides all five services, the three resolvers that
	// call them and the publisher the two subscribable facts travel through, so importing it is what
	// makes the resolver graph above resolvable.
	ChannelModule,
	// 🛑 The subscription module is imported **here**, by the module that hosts the resolvers, and not
	// only inside `ChannelModule`. A module's imports are not inherited by the module that imports it:
	// `ChannelModule` importing this one gives its *own* providers the pub-sub, while the channel
	// resolver is a provider of *this* module — it is listed in `providers` below — so its dependencies
	// are resolved here. Leaving it out booted into `Nest can't resolve dependencies of the
	// ChannelResolver (…, ?)`, which no static check sees, because the resolver and the module that
	// provides the dependency it injects are each individually correct.
	GraphqlSubscriptionModule,
	// The party-data kernel, one module per domain. `ContactGroupMemberModule` is listed beside the
	// group module rather than inside it because it imports the group module — the membership write has
	// to ask whether the group's kind allows a hand-written row — so the two are imported here in the
	// order their own dependency already fixes.
	AddressModule,
	ContactGroupModule,
	ContactGroupMemberModule,
	ContactCredentialModule,
	ContactBuyerModule
];

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
