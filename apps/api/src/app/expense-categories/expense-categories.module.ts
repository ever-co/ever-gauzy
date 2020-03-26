import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpenseCategory } from './expense-category.entity';
import { ExpenseCategoriesService } from './expense-categories.service';

@Module({
	imports: [TypeOrmModule.forFeature([ExpenseCategory])],
	providers: [ExpenseCategoriesService]
})
export class ExpenseCategoriesModule {}
