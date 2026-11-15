import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { InvoiceScheduleController } from './invoice-schedule.controller';
import { InvoiceScheduleRun } from './invoice-schedule-run.entity';
import { InvoiceSchedule } from './invoice-schedule.entity';
import { InvoiceScheduleService } from './invoice-schedule.service';
import { MikroOrmInvoiceScheduleRepository } from './repository/mikro-orm-invoice-schedule.repository';
import { TypeOrmInvoiceScheduleRepository } from './repository/type-orm-invoice-schedule.repository';

/**
 * The billing schedules of clients and their runs (ever-co/ever-gauzy#11855). `RolePermissionModule` is there for
 * `PermissionGuard`.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([InvoiceSchedule, InvoiceScheduleRun]),
		MikroOrmModule.forFeature([InvoiceSchedule, InvoiceScheduleRun]),
		RolePermissionModule
	],
	controllers: [InvoiceScheduleController],
	providers: [InvoiceScheduleService, TypeOrmInvoiceScheduleRepository, MikroOrmInvoiceScheduleRepository],
	exports: [InvoiceScheduleService]
})
export class InvoiceScheduleModule {}
