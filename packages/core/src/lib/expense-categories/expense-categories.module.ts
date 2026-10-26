import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { ExpenseCategory } from './expense-category.entity';
import { ExpenseCategoriesService } from './expense-categories.service';
import { ExpenseCategoriesController } from './expense-categories.controller';
import { ExpenseCategoriesResolver } from './expense-categories.resolver';
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
		// The GraphQL surface is declared beside the service it calls, so the host that scans this
		// module for resolvers reaches everything the resolver injects.
		ExpenseCategoriesResolver,
		TypeOrmExpenseCategoryRepository,
		MikroOrmExpenseCategoryRepository,
		...CommandHandlers
	],
	exports: [ExpenseCategoriesService, TypeOrmExpenseCategoryRepository, MikroOrmExpenseCategoryRepository]
})
export class ExpenseCategoriesModule {}
