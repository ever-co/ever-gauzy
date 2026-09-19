import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { DashboardWidget } from './dashboard-widget.entity';
import { DashboardWidgetService } from './dashboard-widget.service';
import { DashboardWidgetController } from './dashboard-widget.controller';
import { DashboardWidgetResolver } from './dashboard-widget.resolver';
import { TypeOrmDashboardWidgetRepository } from './repository/type-orm-dashboard-widget.repository';
import { MikroOrmDashboardWidgetRepository } from './repository/mikro-orm-dashboard-widget.repository';

/**
 * The widgets a dashboard is assembled from.
 *
 * `DashboardWidgetResolver` is declared here beside the service it calls, because a resolver can only
 * inject services its own module can reach and this module is what reaches them.
 * `DashboardWidgetService` is re-exported for it, and `CqrsModule` with it, because the resolver
 * dispatches the same two commands the REST controller dispatches: a resolver is a provider of
 * whichever module hosts the handler the Apollo configuration names — the GraphQL module, not this one
 * — so a module that imports this one receives them only if this module hands them on. The controller
 * beside the resolver resolves both from this module's own imports, which is why nothing needed
 * exporting until the GraphQL view of the same resource existed.
 *
 * The gate this resolver carries needs no import here. `FeatureFlagGuard` is a guard, and a guard's
 * dependency is a provider of whichever module hosts the handler it protects — but `FeatureModule` is
 * global, so the feature service the guard resolves through is reachable from every module that
 * declares a resolver, which is what the global declaration is for. See `feature.module.ts`.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([DashboardWidget]),
		MikroOrmModule.forFeature([DashboardWidget]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [DashboardWidgetController],
	providers: [
		DashboardWidgetService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		DashboardWidgetResolver,
		TypeOrmDashboardWidgetRepository,
		MikroOrmDashboardWidgetRepository,
		...CommandHandlers
	],
	exports: [DashboardWidgetService, CqrsModule]
})
export class DashboardWidgetModule {}