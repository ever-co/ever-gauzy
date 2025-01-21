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
import { MikroOrmExpenseCategoryRepository } from './repository/mikro-orm-expense-category.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([ExpenseCategory]),
		MikroOrmModule.forFeature([ExpenseCategory]),
		forwardRef(() => RolePermissionModule),
		CqrsModule
	],
	controllers: [ExpenseCategoriesController],
	providers: [
		ExpenseCategoriesService,
		TypeOrmExpenseCategoryRepository,
		MikroOrmExpenseCategoryRepository,
		...CommandHandlers
	],
	exports: [ExpenseCategoriesService, TypeOrmExpenseCategoryRepository, MikroOrmExpenseCategoryRepository]
})
export class ExpenseCategoriesModule {}
