import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { ProductOption } from './product-option.entity';
import { ProductOptionService } from './product-option.service';
import { ProductOptionController } from './product-option.controller';
import { TenantModule } from '../tenant/tenant.module';
import { ProductOptionGroupService } from './product-option-group.service';
import { ProductOptionTranslation } from './product-option-translation.entity';
import { ProductOptionGroup } from './product-option-group.entity';
import { ProductOptionGroupTranslation } from './product-option-group-translation.entity';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			ProductOption,
			ProductOptionTranslation,
			ProductOptionGroup,
			ProductOptionGroupTranslation
		]), 
		TenantModule
	],
	controllers: [ProductOptionController],
	providers: [
		ProductOptionService,
		ProductOptionGroupService
	],
	exports: [
		ProductOptionService,
		ProductOptionGroupService
	]
})
export class ProductOptionModule {}
