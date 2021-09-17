import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { RolePermissionController } from './role-permission.controller';
import { RolePermission } from './role-permission.entity';
import { RolePermissionService } from './role-permission.service';
import { UserModule } from '../user/user.module';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: 'role-permissions', module: RolePermissionModule }
		]),
		forwardRef(() => TypeOrmModule.forFeature([ RolePermission ])),
		forwardRef(() => TenantModule),
		forwardRef(() => UserModule),
		CqrsModule
	],
	controllers: [RolePermissionController],
	providers: [RolePermissionService],
	exports: [TypeOrmModule, RolePermissionService]
})
export class RolePermissionModule {}
