import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { RolePermissionsController } from './role-permissions.controller';
import { RolePermission } from './role-permission.entity';
import { RolePermissionsService } from './role-permissions.service';
import { UserModule } from '../user/user.module';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: 'role-permissions', module: RolePermissionsModule }
		]),
		forwardRef(() => TypeOrmModule.forFeature([ RolePermission ])),
		forwardRef(() => TenantModule),
		forwardRef(() => UserModule),
		CqrsModule
	],
	controllers: [RolePermissionsController],
	providers: [RolePermissionsService],
	exports: [TypeOrmModule, RolePermissionsService]
})
export class RolePermissionsModule {}
