import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { OrganizationPosition } from './organization-position.entity';
import { OrganizationPositionController } from './organization-position.controller';
import { OrganizationPositionService } from './organization-position.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmOrganizationPositionRepository } from './repository/type-orm-organization-position.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationPosition]),
		MikroOrmModule.forFeature([OrganizationPosition]),
		RolePermissionModule
	],
	controllers: [OrganizationPositionController],
	providers: [OrganizationPositionService, TypeOrmOrganizationPositionRepository]
})
export class OrganizationPositionModule {}
