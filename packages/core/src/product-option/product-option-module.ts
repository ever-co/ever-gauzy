import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { ProductOption } from './product-option.entity';
import { ProductOptionService } from './product-option.service';
import { ProductOptionController } from './product-option.controller';
import { TenantModule } from '../tenant/tenant.module';
import { ProductOptionGroupService } from './product-option-group.service';

@Module({
	imports: [TypeOrmModule.forFeature([ProductOption]), TenantModule],
	controllers: [ProductOptionController],
	providers: [ProductOptionService, ProductOptionGroupService],
	exports: [ProductOptionService]
})
export class ProductOptionModule {}
