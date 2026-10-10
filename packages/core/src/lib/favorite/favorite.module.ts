import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { EmployeeModule } from '../employee/employee.module';
import { Favorite } from './favorite.entity';
import { TypeOrmFavoriteRepository } from './repository/type-orm-favorite.repository';
import { MikroOrmFavoriteRepository } from './repository/mikro-orm-favorite.repository';
import { FavoriteService } from './favorite.service';
import { FavoriteController } from './favorite.controller';
import { FavoriteResolver } from './favorite.resolver';
import { GlobalFavoriteModule } from './global-favorite-service.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([Favorite]),
		MikroOrmModule.forFeature([Favorite]),
		RolePermissionModule,
		EmployeeModule,
		GlobalFavoriteModule
	],
	controllers: [FavoriteController],
	providers: [
		FavoriteService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module already reaches the one it needs. Nothing
		// is re-exported for it — the resolver injects no command bus, so this module hands nothing on.
		FavoriteResolver,
		TypeOrmFavoriteRepository,
		MikroOrmFavoriteRepository
	],
	exports: [FavoriteService, TypeOrmFavoriteRepository, MikroOrmFavoriteRepository]
})
export class FavoriteModule {}