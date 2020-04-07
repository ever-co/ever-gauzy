import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserOrganizationService } from './user-organization.services';
import { UserOrganizationController } from './user-organization.controller';
import { UserOrganization } from './user-organization.entity';
import { Organization } from '../organization/organization.entity';
@Module({
	imports: [
		forwardRef(() =>
			TypeOrmModule.forFeature([UserOrganization, Organization])
		)
	],
	controllers: [UserOrganizationController],
	providers: [UserOrganizationService],
	exports: [UserOrganizationService]
})
export class UserOrganizationModule {}
