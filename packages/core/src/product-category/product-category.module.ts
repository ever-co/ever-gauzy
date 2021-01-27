import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductCategory } from './product-category.entity';
import { ProductCategoryService } from './product-category.service';
import { ProductCategoryController } from './product-category.controller';
import { ProductCategoryTranslation } from './product-category-translation.entity';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([ProductCategory, ProductCategoryTranslation]),
		TenantModule
	],
	controllers: [ProductCategoryController],
	providers: [ProductCategoryService]
})
export class ProductCategoriesModule {}
