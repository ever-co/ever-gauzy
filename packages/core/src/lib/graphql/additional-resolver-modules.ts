/**
 * The modules Apollo scans for resolvers beside the host and the configured plugins.
 *
 * The host module (`graphql-api.module.ts`) imports the domain modules whose resolvers it hosts, which is
 * the ordinary arrangement: the resolver is a provider of the host, and the host reaches the services it
 * needs by importing them. Seven domains are the exception, and for the same underlying reason — the host
 * importing them pulls a zone into the core barrel's own evaluation that is not yet defined at that point.
 *
 * - `InvoiceModule` and `InvoiceItemModule` already sit in a service cycle with each other's neighbour, so
 *   adding the host as a third participant fails the boot inside the invoice module with a circular
 *   dependency it cannot name precisely.
 * - `ContactModule` and `OrganizationContactModule` reach the organization module, which reaches the tenant
 *   module, the auth module and the refresh-token module — and the refresh-token module reads the token
 *   module while the graph is still being built when the entry point is a token repository. Every spec that
 *   imports the application module enters exactly there, so the host importing them fails those specs
 *   before anything they test is loaded.
 * - `UserModule`, `UserOrganizationModule` and `EmailResetModule` are the same zone by another road: a user
 *   membership reaches the organization module, which reaches the channel module, which reaches the host
 *   module — so the host importing one of them closes a circle it is already standing in.
 *
 * Their resolvers are therefore declared by their own modules, and naming those modules in the Apollo
 * `include` list is what makes the endpoint scan them where they live — the same arrangement a plugin's
 * resolvers use. Nothing about the resolvers themselves changes: they call the same services they called
 * while the host declared them.
 *
 * **Why this is a function rather than an array.** The option is read while the GraphQL module is being
 * assembled, and the classes are required at that moment rather than at the top of this file. A
 * module-scope `import` here would put the very zones named above back into the core barrel's evaluation
 * — the edge this exists to remove. Deferring the require to the point of use costs nothing: nothing loads
 * these modules until a GraphQL endpoint is actually configured.
 *
 * @returns The modules that declare a resolver the host cannot host.
 */
export function resolveAdditionalResolverModules(): Function[] {
	return [
		require('../invoice/invoice.module').InvoiceModule,
		require('../invoice-item/invoice-item.module').InvoiceItemModule,
		require('../contact/contact.module').ContactModule,
		require('../organization-contact/organization-contact.module').OrganizationContactModule,
		// The identity zone: a user membership reaches the organization module, which reaches the
		// channel module, which reaches the host module — and the host importing any of them closes the
		// circle it is already inside. Their resolvers are declared by their own modules.
		require('../user/user.module').UserModule,
		require('../user-organization/user-organization.module').UserOrganizationModule,
		// The reset flow imports the user, employee, auth and email-send modules, which is the same zone
		// by another road.
		require('../email-reset/email-reset.module').EmailResetModule,
		// The aggregates read across the whole platform — employees, teams, tenants, users, invoices,
		// payments, tasks and tracked time — so this module sits in the middle of every one of those
		// graphs and cannot be pulled into the barrel that is already inside them.
		require('../stats/stats.module').StatsModule
	];
}
