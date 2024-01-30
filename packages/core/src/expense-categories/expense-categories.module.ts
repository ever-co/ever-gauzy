import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from '@nestjs/core';
import { ExpenseCategory } from './expense-category.entity';
import { ExpenseCategoriesService } from './expense-categories.service';
import { ExpenseCategoriesController } from './expense-categories.controller';
import { UserModule } from './../user/user.module';
import { TenantModule } from '../tenant/tenant.module';
import { CommandHandlers } from './commands/handlers';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		RouterModule.register([{ path: '/expense-categories', module: ExpenseCategoriesModule }]),
		TypeOrmModule.forFeature([ExpenseCategory]),
		MikroOrmModule.forFeature([ExpenseCategory]),
		forwardRef(() => TenantModule),
		forwardRef(() => UserModule),
		CqrsModule
	],
	controllers: [ExpenseCategoriesController],
	providers: [ExpenseCategoriesService, ...CommandHandlers],
	exports: [TypeOrmModule, MikroOrmModule, ExpenseCategoriesService]
})
export class ExpenseCategoriesModule { }
