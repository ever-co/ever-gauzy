import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { ImageAssetController } from './image-asset.controller';
import { ImageAssetResolver } from './image-asset.resolver';
import { ImageAsset } from './image-asset.entity';
import { ImageAssetService } from './image-asset.service';
import { TypeOrmImageAssetRepository } from './repository/type-orm-image-asset.repository';
import { MikroOrmImageAssetRepository } from './repository/mikro-orm-image-asset.repository';

/**
 * The stored image.
 *
 * The resolver is declared here, beside the service it calls: a resolver is an ordinary Nest provider
 * and can only inject what the module hosting it can reach. It injects the service and nothing else —
 * the upload's command bus stays where the delivered route needs it, because the upload is the one
 * route this domain's GraphQL surface does not carry.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([ImageAsset]),
		MikroOrmModule.forFeature([ImageAsset]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [ImageAssetController],
	providers: [
		ImageAssetService,
		// The GraphQL view of the same resource.
		ImageAssetResolver,
		TypeOrmImageAssetRepository,
		MikroOrmImageAssetRepository,
		...CommandHandlers
	]
})
export class ImageAssetModule {}