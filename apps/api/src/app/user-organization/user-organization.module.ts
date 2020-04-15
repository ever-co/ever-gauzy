import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserOrganizationService } from './user-organization.services';
import { UserOrganizationController } from './user-organization.controller';
import { UserOrganization } from './user-organization.entity';
import { Organization } from '../organization/organization.entity';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
@Module({
	imports: [
		forwardRef(() =>
			TypeOrmModule.forFeature([UserOrganization, Organization, User])
		)
	],
	controllers: [UserOrganizationController],
	providers: [UserOrganizationService, UserService],
	exports: [UserOrganizationService]
})
export class UserOrganizationModule {}
