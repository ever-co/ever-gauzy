import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { InvoiceEstimateHistoryController } from './invoice-estimate-history.controller';
import { InvoiceEstimateHistoryService } from './invoice-estimate-history.service';
import { InvoiceEstimateHistory } from './invoice-estimate-history.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TaskModule } from '../tasks/task.module';
import { TypeOrmInvoiceEstimateHistoryRepository } from './repository/type-orm-invoice-estimate-history.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([InvoiceEstimateHistory]),
		MikroOrmModule.forFeature([InvoiceEstimateHistory]),
		RolePermissionModule,
		TaskModule
	],
	controllers: [InvoiceEstimateHistoryController],
	providers: [InvoiceEstimateHistoryService, TypeOrmInvoiceEstimateHistoryRepository]
})
export class InvoiceEstimateHistoryModule {}
