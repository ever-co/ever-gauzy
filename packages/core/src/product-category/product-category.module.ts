import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { CqrsModule } from '@nestjs/cqrs';
import { ProductCategory } from './product-category.entity';
import { ProductCategoryService } from './product-category.service';
import { ProductCategoryController } from './product-category.controller';
import { ProductCategoryTranslation } from './product-category-translation.entity';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/product-categories', module: ProductCategoryModule }
		]),
		TypeOrmModule.forFeature([
			ProductCategory,
			ProductCategoryTranslation
		]),
		TenantModule,
		UserModule,
		CqrsModule
	],
	controllers: [ProductCategoryController],
	providers: [
		ProductCategoryService,
		...CommandHandlers
	],
	exports: [
		TypeOrmModule,
		ProductCategoryService
	]
})
export class ProductCategoryModule {}
