import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ProductOption } from './product-option.entity';
import { ProductOptionService } from './product-option.service';
import { ProductOptionController } from './product-option.controller';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { ProductOptionGroupService } from './product-option-group.service';
import { ProductOptionTranslation } from './product-option-translation.entity';
import { ProductOptionGroup } from './product-option-group.entity';
import { ProductOptionGroupTranslation } from './product-option-group-translation.entity';

const forFeatureEntities = [
	ProductOption,
	ProductOptionTranslation,
	ProductOptionGroup,
	ProductOptionGroupTranslation
];

@Module({
	imports: [
		RouterModule.register([{ path: '/product-options', module: ProductOptionModule }]),
		TypeOrmModule.forFeature(forFeatureEntities),
		MikroOrmModule.forFeature(forFeatureEntities),
		RolePermissionModule
	],
	controllers: [ProductOptionController],
	providers: [ProductOptionService, ProductOptionGroupService],
	exports: [ProductOptionService, ProductOptionGroupService]
})
export class ProductOptionModule { }
