import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ReportCategory } from './report-category.entity';
import { Report } from './report.entity';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { ReportCategoryController } from './report-category.controller';
import { ReportCategoryService } from './report-category.service';
import { ReportResolver } from './report.resolver';
import { ReportOrganization } from './report-organization.entity';
import { CommandHandlers } from './commands/handlers';
import { ReportOrganizationService } from './report-organization.service';
import { TypeOrmReportOrganizationRepository } from './repository/type-orm-report-organization.repository';
import { MikroOrmReportOrganizationRepository } from './repository/mikro-orm-report-organization.repository';
import { TypeOrmReportRepository } from './repository/type-orm-report.repository';
import { MikroOrmReportRepository } from './repository/mikro-orm-report.repository';
import { TypeOrmReportCategoryRepository } from './repository/type-orm-report-category.repository';
import { MikroOrmReportCategoryRepository } from './repository/mikro-orm-report-category.repository';

/**
 * The report catalogue and the menu an organization builds from it.
 *
 * `ReportResolver` is declared here beside the three services it calls, because a resolver can only
 * inject services its own module can reach and this module is what reaches them. Those services are
 * re-exported for it, not merely provided: a resolver is a provider of whichever module hosts the
 * handler the Apollo configuration names — the GraphQL module, not this one — so a module that
 * imports this one receives them only if this module hands them on. The two REST controllers beside
 * the resolver resolve the same services from this module's own providers, which is why nothing
 * needed exporting until the GraphQL view of the same resource existed.
 *
 * The gate this resolver carries needs no import here. `FeatureFlagGuard` is a guard, and a guard's
 * dependency is a provider of whichever module hosts the handler it protects — but `FeatureModule` is
 * global, so the feature service the guard resolves through is reachable from every module that
 * declares a resolver, which is what the global declaration is for. See `feature.module.ts`.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([Report, ReportCategory, ReportOrganization]),
		MikroOrmModule.forFeature([Report, ReportCategory, ReportOrganization])
	],
	controllers: [ReportCategoryController, ReportController],
	providers: [
		ReportService,
		ReportCategoryService,
		ReportOrganizationService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		ReportResolver,
		TypeOrmReportRepository, MikroOrmReportRepository,
		TypeOrmReportCategoryRepository, MikroOrmReportCategoryRepository,
		TypeOrmReportOrganizationRepository, MikroOrmReportOrganizationRepository,
		...CommandHandlers
	],
	exports: [ReportService, ReportCategoryService, ReportOrganizationService]
})
export class ReportModule {}