import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermissionsController } from './role-permissions.controller';
import { RolePermissions } from './role-permissions.entity';
import { RolePermissionsService } from './role-permissions.service';
import { User, UserService } from '../user';

@Module({
	imports: [TypeOrmModule.forFeature([RolePermissions, User])],
	controllers: [RolePermissionsController],
	providers: [RolePermissionsService, UserService],
	exports: [RolePermissionsService]
})
export class RolePermissionsModule {}
