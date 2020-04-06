import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role, RoleService } from '../role';
import { User, UserService } from '../user';
import {
	UserOrganization,
	UserOrganizationService
} from '../user-organization';
import { CommandHandlers } from './commands/handlers';
import { OrganizationController } from './organization.controller';
import { Organization } from './organization.entity';
import { OrganizationService } from './organization.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([Organization, User, UserOrganization, Role]),
		CqrsModule
	],
	controllers: [OrganizationController],
	providers: [
		OrganizationService,
		UserService,
		UserOrganizationService,
		RoleService,
		...CommandHandlers
	],
	exports: [OrganizationService]
})
export class OrganizationModule {}
