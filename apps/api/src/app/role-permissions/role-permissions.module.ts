import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermissionsController } from './role-permissions.controller';
import { RolePermissions } from './role-permissions.entity';
import { RolePermissionsService } from './role-permissions.service';

@Module({
	imports: [TypeOrmModule.forFeature([RolePermissions])],
	controllers: [RolePermissionsController],
	providers: [RolePermissionsService],
	exports: [RolePermissionsService]
})
export class RolePermissionsModule {}
