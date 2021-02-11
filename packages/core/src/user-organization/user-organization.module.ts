import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { UserOrganizationService } from './user-organization.services';
import { UserOrganizationController } from './user-organization.controller';
import { UserOrganization } from './user-organization.entity';
import { Organization } from '../organization/organization.entity';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { CommandHandlers } from './commands';
import { SharedModule } from '../shared';
import { Role } from '../role/role.entity';
import { RoleService } from '../role/role.service';
import { TenantModule } from '../tenant/tenant.module';
import { RouterModule } from 'nest-router';

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
