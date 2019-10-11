import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './organization.entity';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';
import { AuthService } from '../auth';
import { UserService, User } from '../user';

@Module({
	imports: [
		TypeOrmModule.forFeature([Organization]),
		TypeOrmModule.forFeature([User])
	],
	controllers: [OrganizationController],
	providers: [OrganizationService, AuthService, UserService],
	exports: [OrganizationService]
})
export class OrganizationModule {}
