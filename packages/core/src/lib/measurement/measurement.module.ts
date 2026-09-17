import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { MikroORM } from '@mikro-orm/core';
import { DataSource } from 'typeorm';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { UnitCategory } from './unit-category.entity';
import { Unit } from './unit.entity';
import { UnitCategoryController } from './unit-category.controller';
import { UnitController } from './unit.controller';
import { UnitCategoryService } from './unit-category.service';
import { UnitService } from './unit.service';
import { UnitCategoryResolver } from './unit-category.resolver';
import { UnitResolver } from './unit.resolver';
import { MeasurementAuditConnection } from './measurement-audit.connection';
import { MEASUREMENT_AUDIT_CONNECTION, MeasurementAuditService } from './measurement-audit.service';
import { MeasurementAuditScheduler } from './measurement-audit.scheduler';
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
 *
 * The audit's connection is built by a factory rather than provided as the class, because its two
 * dependencies are optional: an installation uses one ORM, and the other's global module may not be
 * initialised at all. The factory is what turns "whichever ORM this deployment has" into the one
 * narrow query surface the audit is written against, and it is also the seam a test replaces.
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
		MikroOrmUnitRepository,
		{
			provide: MEASUREMENT_AUDIT_CONNECTION,
			useFactory: (dataSource?: DataSource, mikroOrm?: MikroORM) =>
				new MeasurementAuditConnection(dataSource, mikroOrm),
			inject: [
				{ token: DataSource, optional: true },
				{ token: MikroORM, optional: true }
			]
		},
		MeasurementAuditService,
		MeasurementAuditScheduler
	],
	exports: [UnitCategoryService, UnitService, MeasurementAuditService]
})
export class MeasurementModule {}
