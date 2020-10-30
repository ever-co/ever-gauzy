import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpenseCategory } from './expense-category.entity';
import { ExpenseCategoriesService } from './expense-categories.service';
import { ExpenseCategoriesController } from './expense-categories.controller';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [TypeOrmModule.forFeature([ExpenseCategory]), TenantModule],
	controllers: [ExpenseCategoriesController],
	providers: [ExpenseCategoriesService]
})
export class ExpenseCategoriesModule {}
