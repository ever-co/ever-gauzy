import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { CacheModule } from '@nestjs/cache-manager';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionController } from './role-permission.controller';
import { RolePermission } from './role-permission.entity';
import { RolePermissionService } from './role-permission.service';
import { RoleModule } from './../role/role.module';
import { TypeOrmRolePermissionRepository } from './repository/type-orm-role-permission.repository';
import { MikroOrmRolePermissionRepository } from './repository/mikro-orm-role-permission.repository';

@Module({
	imports: [
		CqrsModule,
		CacheModule.register({ isGlobal: true }),
		TypeOrmModule.forFeature([RolePermission]),
		MikroOrmModule.forFeature([RolePermission]),
		forwardRef(() => RoleModule)
	],
	controllers: [RolePermissionController],
	providers: [RolePermissionService, TypeOrmRolePermissionRepository, MikroOrmRolePermissionRepository],
	exports: [CacheModule, RolePermissionService, TypeOrmRolePermissionRepository, MikroOrmRolePermissionRepository]
})
export class RolePermissionModule {}