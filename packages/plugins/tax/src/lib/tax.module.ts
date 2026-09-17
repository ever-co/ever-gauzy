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
import { TaxCalculationController } from './tax-rate/tax-calculation.controller';
import { TaxRateController } from './tax-rate/tax-rate.controller';
import { TaxRate } from './tax-rate/tax-rate.entity';
import { TaxRateService } from './tax-rate/tax-rate.service';
import { MikroOrmTaxRateRepository } from './tax-rate/repository/mikro-orm-tax-rate.repository';
import { TypeOrmTaxRateRepository } from './tax-rate/repository/type-orm-tax-rate.repository';

/**
 * The tax module.
 *
 * Both entities are registered with both ORMs, because the platform builds one module graph and selects
 * the ORM at bootstrap; the repositories are the providers the services inject, one pair per entity. The
 * resolvers are provided here rather than by the host: a plugin's resolver may inject whatever its own
 * module imports, and the module is what supplies it.
 */
@Module({
	controllers: [TaxCategoryController, TaxRateController, TaxCalculationController],
	imports: [
		TypeOrmModule.forFeature([TaxCategory, TaxRate]),
		MikroOrmModule.forFeature([TaxCategory, TaxRate]),
		RolePermissionModule
	],
	providers: [
		TaxCategoryService,
		TaxRateService,
		TypeOrmTaxCategoryRepository,
		MikroOrmTaxCategoryRepository,
		TypeOrmTaxRateRepository,
		MikroOrmTaxRateRepository,
		...resolvers
	],
	exports: [TaxCategoryService, TaxRateService]
})
export class TaxModule {}
