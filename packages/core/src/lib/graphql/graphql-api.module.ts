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
import { ProductVariantResolver } from './../product-variant/product-variant.resolver';
import { ProductVariantModule } from './../product-variant/product-variant.module';
import { ProductResolver } from './../product/product.resolver';
import { ProductModule } from './../product/product.module';
import { ProductCategoryResolver } from './../product-category/product-category.resolver';
import { ProductCategoryModule } from './../product-category/product-category.module';
import { ProductTypeResolver } from './../product-type/product-type.resolver';
import { ProductTypeModule } from './../product-type/product-type.module';
import { ProductOptionResolver } from './../product-option/product-option.resolver';
import { ProductOptionModule } from './../product-option/product-option-module';
import { ProductVariantPriceResolver } from './../product-variant-price/product-variant-price.resolver';
import { ProductVariantPriceModule } from './../product-variant-price/product-variant-price-module';
import { ProductVariantSettingResolver } from './../product-setting/product-setting.resolver';
import { ProductVariantSettingModule } from './../product-setting/product-setting.module';
import { TagResolver } from './../tags/tag.resolver';
import { TagModule } from './../tags/tag.module';
import { TagTypeResolver } from './../tag-type/tag-type.resolver';
import { TagTypeModule } from './../tag-type/tag-type.module';
import { CurrencyResolver } from './../currency/currency.resolver';
import { CurrencyModule } from './../currency/currency.module';
import { CountryResolver } from './../country/country.resolver';
import { CountryModule } from './../country/country.module';
import { FeatureToggleResolver } from './../feature/feature-toggle.resolver';
import { FeatureModule } from './../feature/feature.module';
import { TenantSettingResolver } from './../tenant/tenant-setting/tenant-setting.resolver';
import { TenantSettingModule } from './../tenant/tenant-setting/tenant-setting.module';
import { RolePermissionResolver } from './../role-permission/role-permission.resolver';
import { PaymentResolver } from './../payment/payment.resolver';
import { PaymentModule } from './../payment/payment.module';
import { EmailTemplateResolver } from './../email-template/email-template.resolver';
import { EmailTemplateModule } from './../email-template/email-template.module';
import { ReportResolver } from './../reports/report.resolver';
import { ReportModule } from './../reports/report.module';
import { DashboardResolver } from './../dashboard/dashboard.resolver';
import { DashboardModule } from './../dashboard/dashboard.module';
import { DashboardWidgetResolver } from './../dashboard/dashboard-widget/dashboard-widget.resolver';
import { DashboardWidgetModule } from './../dashboard/dashboard-widget/dashboard-widget.module';

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
	ContactBuyerResolver,
	// The catalogue's buyable unit. A variant is served over REST by `/api/product-variants`, so the
	// same capability is served here rather than over REST alone.
	ProductVariantResolver,
	// The rest of the catalogue: the product, its category and type, its options, and the two rows that
	// hang off a variant — its price and its setting. Each was served over REST and nowhere else, so each
	// is a capability the one GraphQL endpoint was missing. Every one of them mirrors its own controller's
	// routes, including the guard chain and the permission each route carries.
	ProductResolver,
	ProductCategoryResolver,
	ProductTypeResolver,
	ProductOptionResolver,
	ProductVariantPriceResolver,
	ProductVariantSettingResolver,
	// The facets the catalogue attaches to a product, and the classification a facet belongs to.
	TagResolver,
	TagTypeResolver,
	// The reference data every amount and every address resolves against.
	CurrencyResolver,
	CountryResolver,
	// The configuration the rest of the programme reads: which capabilities are served at all, and what
	// the tenant's settings say about how they behave.
	FeatureToggleResolver,
	TenantSettingResolver,
	// The party records an order, an invoice and a subscription all point at — the customer and the
	// organization's own contact row — are declared by their own modules and scanned from them; see
	// `additional-resolver-modules.ts` for why the host cannot import them.
	//
	// The access-control resource beside the kernel's own role, and the payment ledger every invoice,
	// payroll run and expense on this platform records what it was paid with.
	RolePermissionResolver,
	PaymentResolver,
	// What the platform sends and how a message is composed. The reset flow beside it is scanned from its
	// own module: it imports the user, employee, auth and email-send zones, which the host cannot take on.
	EmailTemplateResolver,
	// The reads a seller, a finance operator and an administrator ask for: the report catalogue and the
	// widgets a dashboard is assembled from. The aggregates over the platform's own records are scanned
	// from their own module instead — `StatsModule` reads across employees, teams, tenants, users,
	// invoices, payments, tasks and tracked time at once, so it sits in the middle of every one of those
	// graphs and cannot be pulled into the barrel that is already inside them.
	ReportResolver,
	DashboardResolver,
	DashboardWidgetResolver
];

/**
 * 🛑 The invoice resolvers are deliberately **not** in the list above, and the reason is a module cycle
 * rather than a preference.
 *
 * `InvoiceModule` and `EstimateEmailModule` already need each other's service and both state it, so this
 * module importing the invoice modules makes a third participant in a cycle that is already closed: the
 * boot then fails inside `InvoiceModule` with a circular dependency it cannot name precisely — a provider
 * read while its own module registration is still in flight.
 *
 * `InvoiceResolver` and `InvoiceItemResolver` are therefore declared by `InvoiceModule` and
 * `InvoiceItemModule` themselves, beside the services they call, and those two modules are named by the
 * Apollo configuration's `additionalResolverModules` (`packages/core/src/lib/graphql/graphql-helper.ts`)
 * so the endpoint scans them for resolvers exactly as it scans a plugin's module. A domain this module
 * can import is hosted here; a domain it cannot import is scanned there — and either way its fields
 * resolve rather than answering null with no error anywhere, which is what an unscanned resolver does.
 */

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
	ContactBuyerModule,
	// The variant module provides the service, the command bus the two write fields dispatch through
	// and the product service the generator reads its product from. The catalogue modules beside it do
	// the same for their own resolvers: each is imported here because a module's imports are not
	// inherited, so the module that hosts a resolver is the module that has to reach its services.
	ProductVariantModule,
	ProductModule,
	ProductCategoryModule,
	ProductTypeModule,
	ProductOptionModule,
	ProductVariantPriceModule,
	ProductVariantSettingModule,
	TagModule,
	TagTypeModule,
	CurrencyModule,
	CountryModule,
	// `FeatureModule` is imported for its service as well as for its resolver: the feature gate on the
	// GraphQL surface is a guard, and a guard is a provider of whichever module hosts the handler it
	// protects — so the module that hosts these resolvers has to reach the feature service itself.
	FeatureModule,
	TenantSettingModule,
	// The access-control, payment, messaging and reporting domains. Each is imported because a module's
	// imports are not inherited: the module that hosts a resolver has to reach the services it calls.
	RolePermissionModule,
	PaymentModule,
	EmailTemplateModule,
	ReportModule,
	DashboardModule,
	DashboardWidgetModule,
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
