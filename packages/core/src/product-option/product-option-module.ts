import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { ProductOption } from './product-option.entity';
import { ProductOptionService } from './product-option.service';
import { ProductOptionController } from './product-option.controller';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [TypeOrmModule.forFeature([ProductOption]), TenantModule],
	controllers: [ProductOptionController],
	providers: [ProductOptionService],
	exports: [ProductOptionService]
})
export class ProductOptionModule {}
