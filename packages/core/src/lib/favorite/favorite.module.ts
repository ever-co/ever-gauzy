import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { EmployeeModule } from '../employee/employee.module';
import { Favorite } from './favorite.entity';
import { TypeOrmFavoriteRepository } from './repository/type-orm-favorite.repository';
import { FavoriteService } from './favorite.service';
import { FavoriteController } from './favorite.controller';
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
	providers: [FavoriteService, TypeOrmFavoriteRepository],
	exports: [FavoriteService, TypeOrmFavoriteRepository]
})
export class FavoriteModule {}
