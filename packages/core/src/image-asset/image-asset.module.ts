import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantModule } from '../tenant/tenant.module';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { ImageAssetController } from './image-asset.controller';
import { ImageAsset } from './image-asset.entity';
import { ImageAssetService } from './image-asset.service';

@Module({
	imports: [TypeOrmModule.forFeature([ImageAsset, User]), TenantModule],
	controllers: [ImageAssetController],
	providers: [ImageAssetService, UserService],
	exports: []
})
export class ImageAssetModule {}
