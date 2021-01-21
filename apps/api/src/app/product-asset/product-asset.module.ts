import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantModule } from '../tenant/tenant.module';
import { ProductAssetController } from './product-asset.controller';
import { ProductAsset } from './product-asset.entity';
import { ProductAssetService } from './product-asset.service';

@Module({
	imports: [TypeOrmModule.forFeature([ProductAsset]), TenantModule],
	controllers: [ProductAssetController],
	providers: [ProductAssetService],
	exports: []
})
export class ProductAssetModule {}
