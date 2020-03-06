import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './organization.entity';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';
import { User, UserService } from '../user';

@Module({
	imports: [TypeOrmModule.forFeature([Organization, User])],
	controllers: [OrganizationController],
	providers: [OrganizationService, UserService],
	exports: [OrganizationService]
})
export class OrganizationModule {}
