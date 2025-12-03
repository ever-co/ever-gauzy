import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { ExpenseCategory } from './expense-category.entity';
import { ExpenseCategoriesService } from './expense-categories.service';
import { ExpenseCategoriesController } from './expense-categories.controller';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmExpenseCategoryRepository } from './repository/type-orm-expense-category.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([ExpenseCategory]),
		MikroOrmModule.forFeature([ExpenseCategory]),
		forwardRef(() => RolePermissionModule),
		CqrsModule
	],
	controllers: [ExpenseCategoriesController],
	providers: [ExpenseCategoriesService, TypeOrmExpenseCategoryRepository, ...CommandHandlers],
	exports: [ExpenseCategoriesService, TypeOrmExpenseCategoryRepository, MikroOrmModule]
})
export class ExpenseCategoriesModule {}
