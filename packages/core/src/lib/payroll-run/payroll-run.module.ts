import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Employee } from './../employee/employee.entity';
import { PayrollItem } from './../payroll-item/payroll-item.entity';
import { MikroOrmPayrollItemRepository } from './../payroll-item/repository/mikro-orm-payroll-item.repository';
import { TypeOrmPayrollItemRepository } from './../payroll-item/repository/type-orm-payroll-item.repository';
import { RolePermissionModule } from './../role-permission/role-permission.module';
import { PayrollRun } from './payroll-run.entity';
import { PayrollRunController } from './payroll-run.controller';
import { PayrollRunResolver } from './payroll-run.resolver';
import { PayrollRunService } from './payroll-run.service';
import { MikroOrmPayrollRunRepository } from './repository/mikro-orm-payroll-run.repository';
import { TypeOrmPayrollRunRepository } from './repository/type-orm-payroll-run.repository';

/**
 * Payroll runs and their line items (issue #2453).
 *
 * `Employee` is registered with `forFeature` here so the service can verify that a line item is
 * paid to somebody in the caller's own organization, without importing `EmployeeModule` and
 * risking a cycle. The GraphQL view of the same resource is declared here too: a resolver can only
 * inject services its own module can reach, and this module is what reaches them.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([PayrollRun, PayrollItem, Employee]),
		MikroOrmModule.forFeature([PayrollRun, PayrollItem]),
		RolePermissionModule
	],
	controllers: [PayrollRunController],
	providers: [
		PayrollRunService,
		PayrollRunResolver,
		TypeOrmPayrollRunRepository,
		MikroOrmPayrollRunRepository,
		TypeOrmPayrollItemRepository,
		MikroOrmPayrollItemRepository
	],
	exports: [PayrollRunService, TypeOrmPayrollRunRepository, MikroOrmPayrollRunRepository]
})
export class PayrollRunModule {}
