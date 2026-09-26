import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '@gauzy/core';
import { resolvers } from './graphql/resolvers';
import { TaxCategoryController } from './tax-category/tax-category.controller';
import { TaxCategory } from './tax-category/tax-category.entity';
import { TaxCategoryService } from './tax-category/tax-category.service';
import { MikroOrmTaxCategoryRepository } from './tax-category/repository/mikro-orm-tax-category.repository';
import { TypeOrmTaxCategoryRepository } from './tax-category/repository/type-orm-tax-category.repository';
import { TaxRateController } from './tax-rate/tax-rate.controller';
import { TaxRate } from './tax-rate/tax-rate.entity';
import { TaxRateService } from './tax-rate/tax-rate.service';
import { MikroOrmTaxRateRepository } from './tax-rate/repository/mikro-orm-tax-rate.repository';
import { TypeOrmTaxRateRepository } from './tax-rate/repository/type-orm-tax-rate.repository';
import { TaxRatePart } from './tax-rate-part/tax-rate-part.entity';
import { TaxRatePartService } from './tax-rate-part/tax-rate-part.service';
import { MikroOrmTaxRatePartRepository } from './tax-rate-part/repository/mikro-orm-tax-rate-part.repository';
import { TypeOrmTaxRatePartRepository } from './tax-rate-part/repository/type-orm-tax-rate-part.repository';
import { TaxRegimeController } from './tax-regime/tax-regime.controller';
import { TaxRegime } from './tax-regime/tax-regime.entity';
import { TaxRegimeService } from './tax-regime/tax-regime.service';
import { MikroOrmTaxRegimeRepository } from './tax-regime/repository/mikro-orm-tax-regime.repository';
import { TypeOrmTaxRegimeRepository } from './tax-regime/repository/type-orm-tax-regime.repository';
import { TaxRegimeRate } from './tax-regime-rate/tax-regime-rate.entity';
import { TaxRegimeRateService } from './tax-regime-rate/tax-regime-rate.service';
import { MikroOrmTaxRegimeRateRepository } from './tax-regime-rate/repository/mikro-orm-tax-regime-rate.repository';
import { TypeOrmTaxRegimeRateRepository } from './tax-regime-rate/repository/type-orm-tax-regime-rate.repository';

/**
 * The tax module.
 *
 * Every entity is registered with both ORMs, because the platform builds one module graph and selects the
 * ORM at bootstrap; the repositories are the providers the services inject, one pair per entity. The
 * resolvers are provided here rather than by the host: a plugin's resolver may inject whatever its own
 * module imports, and the module is what supplies it, which is also why every service below is exported.
 */
@Module({
	controllers: [TaxCategoryController, TaxRateController, TaxRegimeController],
	imports: [
		TypeOrmModule.forFeature([TaxCategory, TaxRate, TaxRatePart, TaxRegime, TaxRegimeRate]),
		MikroOrmModule.forFeature([TaxCategory, TaxRate, TaxRatePart, TaxRegime, TaxRegimeRate]),
		RolePermissionModule
	],
	providers: [
		TaxCategoryService,
		TaxRateService,
		TaxRatePartService,
		TaxRegimeService,
		TaxRegimeRateService,
		TypeOrmTaxCategoryRepository,
		MikroOrmTaxCategoryRepository,
		TypeOrmTaxRateRepository,
		MikroOrmTaxRateRepository,
		TypeOrmTaxRatePartRepository,
		MikroOrmTaxRatePartRepository,
		TypeOrmTaxRegimeRepository,
		MikroOrmTaxRegimeRepository,
		TypeOrmTaxRegimeRateRepository,
		MikroOrmTaxRegimeRateRepository,
		...resolvers
	],
	exports: [TaxCategoryService, TaxRateService, TaxRatePartService, TaxRegimeService, TaxRegimeRateService]
})
export class TaxModule {}
