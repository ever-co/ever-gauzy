import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { ImageAssetController } from './image-asset.controller';
import { ImageAsset } from './image-asset.entity';
import { ImageAssetService } from './image-asset.service';

@Module({
	imports: [
		RouterModule.register([{ path: '/image-assets', module: ImageAssetModule }]),
		TypeOrmModule.forFeature([ImageAsset]),
		MikroOrmModule.forFeature([ImageAsset]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [ImageAssetController],
	providers: [ImageAssetService, ...CommandHandlers],
	exports: [ImageAssetService]
})
export class ImageAssetModule { }
