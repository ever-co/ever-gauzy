import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { InvoiceEstimateHistoryController } from './invoice-estimate-history.controller';
import { InvoiceEstimateHistoryService } from './invoice-estimate-history.service';
import { InvoiceEstimateHistory } from './invoice-estimate-history.entity';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
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
		TypeOrmModule.forFeature([User, InvoiceEstimateHistory]),
		TenantModule,
		TaskModule
	],
	controllers: [InvoiceEstimateHistoryController],
	providers: [InvoiceEstimateHistoryService, UserService],
	exports: [InvoiceEstimateHistoryService, UserService]
})
export class InvoiceEstimateHistoryModule {}
