import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { ExpenseCategory } from './expense-category.entity';
import { ExpenseCategoriesService } from './expense-categories.service';
import { ExpenseCategoriesController } from './expense-categories.controller';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmExpenseCategoryRepository } from './repository';

@Module({
	imports: [
		RouterModule.register([{ path: '/expense-categories', module: ExpenseCategoriesModule }]),
		TypeOrmModule.forFeature([ExpenseCategory]),
		MikroOrmModule.forFeature([ExpenseCategory]),
		forwardRef(() => RolePermissionModule),
		CqrsModule
	],
	controllers: [ExpenseCategoriesController],
	providers: [ExpenseCategoriesService, TypeOrmExpenseCategoryRepository, ...CommandHandlers],
	exports: [TypeOrmModule, MikroOrmModule, ExpenseCategoriesService, TypeOrmExpenseCategoryRepository]
})
export class ExpenseCategoriesModule { }
