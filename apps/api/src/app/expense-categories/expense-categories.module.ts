import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpenseCategory } from './expense-category.entity';
import { ExpenseCategoriesService } from './expense-categories.service';
import { ExpenseCategoriesController } from './expense-categories.controller';

@Module({
	imports: [TypeOrmModule.forFeature([ExpenseCategory])],
	controllers: [ExpenseCategoriesController],
	providers: [ExpenseCategoriesService]
})
export class ExpenseCategoriesModule {}
