import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from '../user/user.module';
import { CommandHandlers } from './commands/handlers';
import { ImageAssetController } from './image-asset.controller';
import { ImageAsset } from './image-asset.entity';
import { ImageAssetService } from './image-asset.service';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		RouterModule.register([{ path: '/image-assets', module: ImageAssetModule }]),
		TypeOrmModule.forFeature([ImageAsset]),
		MikroOrmModule.forFeature([ImageAsset]),
		CqrsModule,
		TenantModule,
		UserModule
	],
	controllers: [ImageAssetController],
	providers: [ImageAssetService, ...CommandHandlers],
	exports: [ImageAssetService]
})
export class ImageAssetModule { }
