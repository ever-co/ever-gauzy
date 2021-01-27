import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermissionsController } from './role-permissions.controller';
import { RolePermissions } from './role-permissions.entity';
import { RolePermissionsService } from './role-permissions.service';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		forwardRef(() => TypeOrmModule.forFeature([RolePermissions, User])),
		forwardRef(() => TenantModule)
	],
	controllers: [RolePermissionsController],
	providers: [RolePermissionsService, UserService],
	exports: [RolePermissionsService]
})
export class RolePermissionsModule {}
