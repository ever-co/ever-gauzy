import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { UnitCategory } from './unit-category.entity';
import { Unit } from './unit.entity';
import { UnitCategoryController } from './unit-category.controller';
import { UnitController } from './unit.controller';
import { UnitCategoryService } from './unit-category.service';
import { UnitService } from './unit.service';
import { UnitCategoryResolver } from './unit-category.resolver';
import { UnitResolver } from './unit.resolver';
import { TypeOrmUnitCategoryRepository } from './repository/type-orm-unit-category.repository';
import { MikroOrmUnitCategoryRepository } from './repository/mikro-orm-unit-category.repository';
import { TypeOrmUnitRepository } from './repository/type-orm-unit.repository';
import { MikroOrmUnitRepository } from './repository/mikro-orm-unit.repository';

/**
 * The measurement families and the units inside them.
 *
 * `RolePermissionModule` is imported for the guards rather than for a service: a guard is a provider of
 * whichever module hosts the handler it protects, so the permission guards every controller and
 * resolver here carries resolve their permission lookup from *this* module.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([UnitCategory, Unit]),
		MikroOrmModule.forFeature([UnitCategory, Unit]),
		RolePermissionModule
	],
	controllers: [UnitCategoryController, UnitController],
	providers: [
		UnitCategoryService,
		UnitService,
		UnitCategoryResolver,
		UnitResolver,
		TypeOrmUnitCategoryRepository,
		MikroOrmUnitCategoryRepository,
		TypeOrmUnitRepository,
		MikroOrmUnitRepository
	],
	exports: [UnitCategoryService, UnitService]
})
export class MeasurementModule {}
