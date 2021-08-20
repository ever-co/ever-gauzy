import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from '../user/user.module';
import { ImageAssetController } from './image-asset.controller';
import { ImageAsset } from './image-asset.entity';
import { ImageAssetService } from './image-asset.service';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/image-assets', module: ImageAssetModule }
		]),
		TypeOrmModule.forFeature([ ImageAsset ]),
		TenantModule,
		UserModule
	],
	controllers: [ImageAssetController],
	providers: [ImageAssetService],
	exports: [ImageAssetService]
})
export class ImageAssetModule {}
