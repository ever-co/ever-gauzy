import { forwardRef, Module } from '@nestjs/common';
import { FeatureModule } from '../feature/feature.module';
import { EmployeeModule } from '../employee/employee.module';
import { OrganizationModule } from '../organization/organization.module';
import { OrganizationTeamModule } from '../organization-team/organization-team.module';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from '../user/user.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { PaymentModule } from '../payment/payment.module';
import { TaskModule } from '../tasks/task.module';
import { StatisticModule } from '../time-tracking/statistic';
import { StatsController } from './stats.controller';
import { StatsResolver } from './stats.resolver';
import { StatsService } from './stats.service';

/**
 * The installation's own aggregate statistics.
 *
 * `StatsResolver` is declared here beside the service it calls, because a resolver can only inject
 * services its own module can reach and this module is what reaches them. `StatsService` is re-exported
 * for it, not merely provided: a resolver is a provider of whichever module hosts the handler the
 * Apollo configuration names — the GraphQL module, not this one — so a module that imports this one
 * receives the service only if this module hands it on. The REST controller beside the resolver
 * resolves the same service from this module's own providers, which is why nothing needed exporting
 * until the GraphQL view of the same resource existed.
 *
 * The gate the resolver carries needs no import here. `FeatureFlagGuard` is a guard, and a guard's
 * dependency is a provider of whichever module hosts the handler it protects — but `FeatureModule` is
 * global, so the feature service the guard resolves through is reachable from every module that
 * declares a resolver, which is what the global declaration is for. See `feature.module.ts`. The one
 * further dependency the guarded field has is this domain's own `StatsGuard`, which reads nothing but
 * the reflector and is therefore resolvable wherever the field is hosted.
 */
@Module({
	imports: [
		FeatureModule,
		// 🛑 Every one of these is a forward reference, and that is not decoration. This module reads
		// across the whole platform, so it names modules that are themselves mid-evaluation whenever this
		// file is reached from an early entry point — the GraphQL host's configuration is one. A plain
		// import then captures `undefined` in this array, and the boot fails with "The module at index [4]
		// of the StatsModule imports array is undefined", naming a position rather than the file that was
		// not ready. A forward reference states the edge without reading the class while it is being built,
		// which is what Nest's own remedy for a cycle is.
		forwardRef(() => EmployeeModule),
		forwardRef(() => OrganizationModule),
		forwardRef(() => OrganizationTeamModule),
		forwardRef(() => TenantModule),
		forwardRef(() => UserModule),
		forwardRef(() => InvoiceModule),
		forwardRef(() => PaymentModule),
		forwardRef(() => TaskModule),
		forwardRef(() => StatisticModule)
	],
	controllers: [StatsController],
	providers: [
		StatsService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		StatsResolver
	],
	exports: [StatsService]
})
export class StatsModule {}
