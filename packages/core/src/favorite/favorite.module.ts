import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { Favorite } from './favorite.entity';
import { TypeOrmFavoriteRepository } from './repository/type-orm-favorite.repository';

@Module({
	imports: [
		RouterModule.register([{ path: '/favorite', module: FavoriteModule }]),
		TypeOrmModule.forFeature([Favorite]),
		MikroOrmModule.forFeature([Favorite]),
		RolePermissionModule
	],
	controllers: [],
	providers: [TypeOrmFavoriteRepository],
	exports: [TypeOrmModule, TypeOrmFavoriteRepository]
})
export class FavoriteModule {}
