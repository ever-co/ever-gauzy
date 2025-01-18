import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ProductOption } from './product-option.entity';
import { ProductOptionService } from './product-option.service';
import { ProductOptionController } from './product-option.controller';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { ProductOptionGroupService } from './product-option-group.service';
import { ProductOptionTranslation } from './product-option-translation.entity';
import { ProductOptionGroup } from './product-option-group.entity';
import { ProductOptionGroupTranslation } from './product-option-group-translation.entity';
import { TypeOrmProductOptionRepository } from './repository/type-orm-product-option.repository';
import { TypeOrmProductOptionTranslationRepository } from './repository/type-orm-product-option-translation.repository';
import { TypeOrmProductOptionGroupRepository } from './repository/type-orm-product-option-group.repository';
import { TypeOrmProductOptionGroupTranslationRepository } from './repository/type-orm-product-option-group-translation.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			ProductOption,
			ProductOptionTranslation,
			ProductOptionGroup,
			ProductOptionGroupTranslation
		]),
		MikroOrmModule.forFeature([
			ProductOption,
			ProductOptionTranslation,
			ProductOptionGroup,
			ProductOptionGroupTranslation
		]),
		RolePermissionModule
	],
	controllers: [ProductOptionController],
	providers: [
		ProductOptionService,
		ProductOptionGroupService,
		TypeOrmProductOptionRepository,
		TypeOrmProductOptionTranslationRepository,
		TypeOrmProductOptionGroupRepository,
		TypeOrmProductOptionGroupTranslationRepository
	]
})
export class ProductOptionModule {}
