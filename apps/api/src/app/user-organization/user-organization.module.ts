import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserOrganizationService } from './user-organization.services';
import { UserOrganizationController } from './user-organization.controller';
import { UserOrganization } from './user-organization.entity';
import { Organization } from '../organization/organization.entity';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { CommandHandlers } from './commands';
import { CqrsModule } from '@nestjs/cqrs';
import { SharedModule } from '../shared';
import { Role } from '../role/role.entity';
import { RoleService } from '../role/role.service';
@Module({
	imports: [
		forwardRef(() =>
			TypeOrmModule.forFeature([
				UserOrganization,
				Organization,
				User,
				Role
			])
		),
		SharedModule,
		CqrsModule
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
