import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { InvoiceEstimateHistoryController } from './invoice-estimate-history.controller';
import { InvoiceEstimateHistoryService } from './invoice-estimate-history.service';
import { InvoiceEstimateHistory } from './invoice-estimate-history.entity';
import { UserModule } from '../user/user.module';
import { TenantModule } from '../tenant/tenant.module';
import { TaskModule } from '../tasks/task.module';

@Module({
	imports: [
		RouterModule.register([
			{
				path: '/invoice-estimate-history',
				module: InvoiceEstimateHistoryModule
			}
		]),
		TypeOrmModule.forFeature([InvoiceEstimateHistory]),
		MikroOrmModule.forFeature([InvoiceEstimateHistory]),
		TenantModule,
		TaskModule,
		UserModule
	],
	controllers: [InvoiceEstimateHistoryController],
	providers: [InvoiceEstimateHistoryService],
	exports: [InvoiceEstimateHistoryService]
})
export class InvoiceEstimateHistoryModule { }
