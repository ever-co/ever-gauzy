import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { UserOrganizationService } from './user-organization.services';
import { UserOrganizationController } from './user-organization.controller';
import { UserOrganization } from './user-organization.entity';
import { UserService } from '../user/user.service';
import { CommandHandlers } from './commands/handlers';
import { SharedModule } from '../shared';
import { RoleService } from '../role/role.service';
import { TenantModule } from '../tenant/tenant.module';
import { Organization, Role, User } from './../core/entities/internal';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/user-organization', module: UserOrganizationModule }
		]),
		forwardRef(() =>
			TypeOrmModule.forFeature([
				UserOrganization,
				Organization,
				User,
				Role
			])
		),
		SharedModule,
		CqrsModule,
		TenantModule
	],
	controllers: [UserOrganizationController],
	providers: [
		UserOrganizationService,
		UserService,
		RoleService,
		...CommandHandlers
	],
	exports: [UserOrganizationService]
})
export class UserOrganizationModule {}
