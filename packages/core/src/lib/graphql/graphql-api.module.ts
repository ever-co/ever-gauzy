import { DynamicModule, Module, Type } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { getConfig } from '@gauzy/config';
import { getResolversFromPlugins, isDynamicModule, reflectDynamicModuleMetadata } from '@gauzy/plugin';
import { CORE_SCALARS } from './scalars';
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
import { IdempotencyKeyResolver } from './../idempotency/idempotency-key.resolver';
import { IdempotencyModule } from './../idempotency/idempotency.module';

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
	DashboardWidgetResolver,
	// The operator's view of the stored retry keys: what a stuck client is holding, and the release
	// that makes its next attempt a first attempt again. Declared by `IdempotencyModule`, which is
	// named among the modules below.
	IdempotencyKeyResolver
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
	// The stored retry keys. `IdempotencyModule` is imported for its resolver and not for its
	// schedule: the cleanup job is declared by the same module, and Nest instantiates a module class
	// once however many modules import it, so the hourly sweep is registered once even though both
	// this graph and the application graph reach it.
	IdempotencyModule
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
	 * 🛑 **The definition is deferred, and that is the whole fix for the first of two defects.** This
	 * used to read `getConfig().plugins` and call `getDynamicPluginsModules()` directly in the body,
	 * and the body runs when `CoreModule`'s own `@Module({ imports: [ … GraphqlApiModule.withPlugins()
	 * … ] })` decorator is evaluated — that is, while `@gauzy/core` is being *imported*.
	 * `packages/core/src/lib/bootstrap/index.ts` imports `AppModule` statically, so `CoreModule` is
	 * evaluated the moment `apps/api/src/main.ts` does `import { bootstrap } from '@gauzy/core'`, long
	 * before `preBootstrapApplicationConfig(pluginConfig)` installs the real configuration. At that
	 * point `@gauzy/config` still holds `{ ...defaultConfiguration }`, whose `plugins` is `[]`, so
	 * `pluginResolvers` was `[]` and the plugin module list was `[]` on every boot of every
	 * installation.
	 *
	 * The symptom was silent and one-sided. `createTypeDefs` merges every plugin's `schemaExtensions`
	 * from `configService.plugins` — read later, when the container is assembled, so it sees the real
	 * configuration — and the composed schema therefore carried every field the commerce packages
	 * declare. `{ orders { items { id } } }` validated and answered `null`; `POST /api/orders`
	 * answered the order. Nothing was logged, because an unbound field is not an error in GraphQL.
	 *
	 * Nest accepts a `Promise<DynamicModule>` in an `imports` array — it is in `ModuleMetadata`'s own
	 * type — and awaits it while it scans, which is after `NestFactory.create(BootstrapModule)` and
	 * therefore after the configuration is installed. {@link deferredModule} returns a thenable that
	 * computes on first await and remembers the result, so the module definition and its token are the
	 * same object however many times the scanner compiles it.
	 *
	 * @returns The dynamic module to import, resolved against the running configuration.
	 */
	static withPlugins(): Promise<DynamicModule> {
		return deferredModule(() => GraphqlApiModule.compose());
	}

	/**
	 * Assembles the module against whatever configuration is installed at the moment it is called.
	 *
	 * 🛑 **The second defect is in the two lines that decide what this module provides and what it
	 * imports**, and it only becomes reachable once the first is fixed — which is why the audit found
	 * them as a pair. Declaring every plugin-contributed resolver as a provider *of this module* makes
	 * this module's injector responsible for their dependencies, and the plugin shells it imports
	 * exported nothing: `getDynamicPluginsModules()` builds each entry from the plugin class's own
	 * `MODULE_METADATA.EXPORTS`, and not one of the sixteen commerce plugins declares `exports:` in its
	 * `@Plugin({...})`. A Nest module sees only what the modules it imports *export*, and a module's
	 * own imports are not re-exported, so `CartPlugin` importing `CartModule` left `CommerceCartService`
	 * invisible here while `CommerceCartResolver` — a provider here — asked for it. The boot failed
	 * with `Nest can't resolve dependencies of the CommerceCartResolver (?)`, taking REST down with it.
	 *
	 * Two changes make it hold, and both are additive:
	 *
	 *   1. **Each plugin shell re-exports what it imports.** A Nest module may legally re-export a
	 *      module it imports, and doing so is what makes the plugin's real module — `CartModule`,
	 *      `OrderModule` — and therefore the services it exports reachable from here. This is done
	 *      locally rather than in `getDynamicPluginsModules()` so the seeder's graph, which uses the
	 *      same helper, is not changed by a fix to the resolver graph; the helper should get the same
	 *      treatment, and that is written up rather than done here because it lives in another package.
	 *   2. **A resolver its own plugin module already provides is not declared again here.** Eleven of
	 *      the sixteen packages list `...resolvers` in their own module's `providers`, and those
	 *      modules are scanned by Apollo through the `include` list the GraphQL configuration builds
	 *      from `configService.plugins`. Declaring a second copy here instantiated the class twice and
	 *      registered every one of its fields twice, with the second registration winning; now the
	 *      module that owns the services owns the resolver, and this module hosts only the resolvers no
	 *      plugin module declares.
	 *
	 * @returns The dynamic module.
	 */
	private static compose(): DynamicModule {
		const plugins = getConfig().plugins ?? [];
		const declaredByPlugins = providersOfPlugins(plugins);
		const hosted = getResolversFromPlugins(plugins).filter((resolver) => !declaredByPlugins.has(resolver));

		const providers = [...CORE_RESOLVERS, ...CORE_SCALARS, ...hosted];

		return {
			module: GraphqlApiModule,
			imports: [...CORE_RESOLVER_MODULES, ...reExportingPluginModules(plugins)],
			providers,
			exports: providers
		};
	}
}

/**
 * Wraps a module definition so it is built the first time Nest awaits it, and only once.
 *
 * The scanner compiles the same import more than once — `insertImport` and `addModule` both go
 * through `ModuleCompiler.compile`, which awaits the definition — and a module's token is derived
 * from its dynamic metadata, so two builds that produced two equal-but-distinct objects would be two
 * modules. The result is therefore remembered and every await answers the same object.
 *
 * A real `Promise` cannot be used: its executor runs when it is constructed, which is the import-time
 * evaluation this whole mechanism exists to avoid.
 *
 * @param build Produces the module definition.
 * @returns A thenable Nest treats as a `Promise<DynamicModule>`.
 */
function deferredModule(build: () => DynamicModule): Promise<DynamicModule> {
	let built: DynamicModule | undefined;

	const resolve = (): DynamicModule => {
		if (!built) {
			built = build();
		}

		return built;
	};

	const thenable = {
		then(onFulfilled?: (value: DynamicModule) => unknown, onRejected?: (reason: unknown) => unknown): unknown {
			try {
				const value = resolve();

				return onFulfilled ? onFulfilled(value) : value;
			} catch (error) {
				if (onRejected) {
					return onRejected(error);
				}

				throw error;
			}
		}
	};

	return thenable as unknown as Promise<DynamicModule>;
}

/**
 * The plugin shells to import, each re-exporting the modules it imports.
 *
 * @param plugins The configured plugins.
 * @returns One dynamic module per plugin.
 */
function reExportingPluginModules(plugins: Array<Type<any> | DynamicModule>): DynamicModule[] {
	return plugins.map((plugin) => {
		const pluginModule = isDynamicModule(plugin) ? plugin.module : plugin;
		const { imports, providers, exports } = reflectDynamicModuleMetadata(pluginModule);

		return {
			module: pluginModule,
			imports,
			// The shell's own exports, plus the modules it imports. Re-exporting an imported module is
			// ordinary Nest, and it is what turns a plugin shell from an opaque box into the thing its
			// name promises: importing the plugin reaches the plugin's services.
			exports: [...exports, ...imports],
			providers: [...providers]
		};
	});
}

/**
 * Every provider the configured plugins' own module graphs declare.
 *
 * The walk follows each plugin's `imports` because a plugin declares a shell whose single import is
 * the module that really holds the providers — `CartPlugin` imports `CartModule`, which provides
 * `CommerceCartResolver` — so a check against the shell alone would find nothing. It is bounded and
 * keeps a seen set, because a module graph legitimately contains cycles and this runs during boot,
 * which is the one place a hang has no symptom but a process that never listens.
 *
 * @param plugins The configured plugins.
 * @returns The provider classes those graphs declare.
 */
function providersOfPlugins(plugins: Array<Type<any> | DynamicModule>): Set<unknown> {
	const declared = new Set<unknown>();
	const seen = new Set<unknown>();
	const queue: unknown[] = [];

	for (const plugin of plugins) {
		queue.push(isDynamicModule(plugin) ? plugin.module : plugin);
	}

	for (let index = 0; index < queue.length && index < PLUGIN_MODULE_WALK_LIMIT; index++) {
		const entry = queue[index];
		const candidate = entry && typeof entry === 'object' && 'module' in (entry as DynamicModule)
			? (entry as DynamicModule).module
			: entry;

		if (!candidate || seen.has(candidate)) {
			continue;
		}

		seen.add(candidate);

		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, candidate) as unknown[]) ?? [];
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, candidate) as unknown[]) ?? [];

		for (const provider of providers) {
			// A provider may be a class or a `{ provide, useX }` object; only a class can be the same
			// class a plugin's `extensions.resolvers` names, so only a class is recorded.
			if (typeof provider === 'function') {
				declared.add(provider);
			}
		}

		for (const imported of imports) {
			queue.push(imported);
		}
	}

	return declared;
}

/**
 * How many modules the provider walk above visits before it stops.
 *
 * Sixteen plugins whose graphs reach the whole platform is a few hundred modules; the bound is an
 * order of magnitude above that, so it is a stop rather than a limit anyone meets.
 */
const PLUGIN_MODULE_WALK_LIMIT = 5000;
