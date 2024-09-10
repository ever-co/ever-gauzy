import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { OrganizationProject } from './organization-project.entity';
import { OrganizationProjectController } from './organization-project.controller';
import { OrganizationProjectService } from './organization-project.service';
import { CommandHandlers } from './commands/handlers';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmOrganizationProjectRepository } from './repository/type-orm-organization-project.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationProject]),
		MikroOrmModule.forFeature([OrganizationProject]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [OrganizationProjectController],
	providers: [OrganizationProjectService, TypeOrmOrganizationProjectRepository, ...CommandHandlers],
	exports: [TypeOrmModule, MikroOrmModule, OrganizationProjectService, TypeOrmOrganizationProjectRepository]
})
export class OrganizationProjectModule {}
