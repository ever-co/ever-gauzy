import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceEstimateHistoryController } from './invoice-estimate-history.controller';
import { InvoiceEstimateHistoryService } from './invoice-estimate-history.service';
import { InvoiceEstimateHistory } from './invoice-estimate-history.entity';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';

@Module({
	imports: [TypeOrmModule.forFeature([User, InvoiceEstimateHistory])],
	controllers: [InvoiceEstimateHistoryController],
	providers: [InvoiceEstimateHistoryService, UserService],
	exports: [InvoiceEstimateHistoryService, UserService]
})
export class InvoiceEstimateHistoryModule {}
