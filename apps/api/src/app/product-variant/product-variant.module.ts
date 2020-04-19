import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { ProductVariant } from './product-variant.entity';
import { ProductVariantController } from './product-variant.controller';
import { ProductVariantService } from './product-variant.service';

@Module({
	imports: [TypeOrmModule.forFeature([ProductVariant])],
	controllers: [ProductVariantController],
	providers: [ProductVariantService],
	exports: [ProductVariantService]
})
export class ProductVariantModule {}
