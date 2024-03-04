import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ProductCategory } from './product-category.entity';
import { ProductCategoryService } from './product-category.service';
import { ProductCategoryController } from './product-category.controller';
import { ProductCategoryTranslation } from './product-category-translation.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.register([{ path: '/product-categories', module: ProductCategoryModule }]),
		TypeOrmModule.forFeature([ProductCategory, ProductCategoryTranslation]),
		MikroOrmModule.forFeature([ProductCategory, ProductCategoryTranslation]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [ProductCategoryController],
	providers: [ProductCategoryService, ...CommandHandlers],
	exports: [TypeOrmModule, MikroOrmModule, ProductCategoryService]
})
export class ProductCategoryModule { }
