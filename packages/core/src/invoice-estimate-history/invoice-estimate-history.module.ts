import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { InvoiceEstimateHistoryController } from './invoice-estimate-history.controller';
import { InvoiceEstimateHistoryService } from './invoice-estimate-history.service';
import { InvoiceEstimateHistory } from './invoice-estimate-history.entity';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/invoice-estimate-history',
				module: InvoiceEstimateHistoryModule
			}
		]),
		TypeOrmModule.forFeature([User, InvoiceEstimateHistory]),
		TenantModule
	],
	controllers: [InvoiceEstimateHistoryController],
	providers: [InvoiceEstimateHistoryService, UserService],
	exports: [InvoiceEstimateHistoryService, UserService]
})
export class InvoiceEstimateHistoryModule {}
