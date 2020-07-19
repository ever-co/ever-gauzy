import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { ProductVariantSettings } from './product-settings.entity';
import { ProductVariantSettingService } from './product-settings.service';
import { ProductVariantSettingsController } from './product-settings.controller';

@Module({
	imports: [TypeOrmModule.forFeature([ProductVariantSettings])],
	controllers: [ProductVariantSettingsController],
	providers: [ProductVariantSettingService],
	exports: [ProductVariantSettingService]
})
export class ProductVariantSettingsModule {}
