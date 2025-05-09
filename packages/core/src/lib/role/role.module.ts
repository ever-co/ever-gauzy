import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Role } from './role.entity';
import { RoleService } from './role.service';
import { RoleController } from './role.controller';
import { RolePermissionModule } from './../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmRoleRepository } from './repository/type-orm-role.repository';
import { MikroOrmRoleRepository } from './repository/mikro-orm-role.repository';

@Module({
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([Role]),
		MikroOrmModule.forFeature([Role]),
		forwardRef(() => RolePermissionModule)
	],
	controllers: [RoleController],
	providers: [RoleService, TypeOrmRoleRepository, MikroOrmRoleRepository, ...CommandHandlers],
	exports: [RoleService, TypeOrmRoleRepository, MikroOrmRoleRepository]
})
export class RoleModule {}
