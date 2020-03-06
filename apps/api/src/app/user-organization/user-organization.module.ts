import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserOrganizationService } from './user-organization.services';
import { UserOrganizationController } from './user-organization.controller';
import { UserOrganization } from './user-organization.entity';
import { User, UserService } from '../user';

@Module({
	imports: [TypeOrmModule.forFeature([UserOrganization, User])],
	controllers: [UserOrganizationController],
	providers: [UserOrganizationService, UserService],
	exports: [UserOrganizationService]
})
export class UserOrganizationModule {}
