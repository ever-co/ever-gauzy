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

@Module({
	imports: [
		forwardRef(() => TypeOrmModule.forFeature([Role])),
		forwardRef(() => MikroOrmModule.forFeature([Role])),
		forwardRef(() => RolePermissionModule),
		CqrsModule
	],
	controllers: [RoleController],
	providers: [...CommandHandlers, RoleService, TypeOrmRoleRepository],
	exports: [TypeOrmModule, MikroOrmModule, RoleService, TypeOrmRoleRepository]
})
export class RoleModule {}
