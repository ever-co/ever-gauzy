import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { ProductCategory } from './product-category.entity';
import { ProductCategoryService } from './product-category.service';
import { ProductCategoryController } from './product-category.controller';
import { ProductCategoryTranslation } from './product-category-translation.entity';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';

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
		UserModule
	],
	controllers: [ProductCategoryController],
	providers: [
		TypeOrmModule,
		ProductCategoryService
	]
})
export class ProductCategoryModule {}
