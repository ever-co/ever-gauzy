import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ExpenseCategory } from './expense-category.entity';
import { ExpenseCategoriesService } from './expense-categories.service';
import { ExpenseCategoriesController } from './expense-categories.controller';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.register([{ path: '/expense-categories', module: ExpenseCategoriesModule }]),
		TypeOrmModule.forFeature([ExpenseCategory]),
		MikroOrmModule.forFeature([ExpenseCategory]),
		forwardRef(() => RolePermissionModule),
		CqrsModule
	],
	controllers: [ExpenseCategoriesController],
	providers: [ExpenseCategoriesService, ...CommandHandlers],
	exports: [TypeOrmModule, MikroOrmModule, ExpenseCategoriesService]
})
export class ExpenseCategoriesModule { }
