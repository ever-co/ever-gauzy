import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { Role } from './role.entity';
import { RoleService } from './role.service';
import { RoleController } from './role.controller';
import { TenantModule } from '../tenant/tenant.module';
import { RolePermissionModule } from './../role-permission/role-permission.module';
import { UserModule } from './../user/user.module';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/roles', module: RoleModule }
		]),
		forwardRef(() => TypeOrmModule.forFeature([ Role ])),
		forwardRef(() => TenantModule),
		forwardRef(() => RolePermissionModule),
		forwardRef(() => UserModule),
		CqrsModule
	],
	controllers: [RoleController],
	providers: [RoleService, ...CommandHandlers],
	exports: [TypeOrmModule, RoleService]
})
export class RoleModule {}
