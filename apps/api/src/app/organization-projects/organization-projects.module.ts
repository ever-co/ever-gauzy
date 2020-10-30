import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationProject } from './organization-projects.entity';
import { OrganizationProjectsController } from './organization-projects.controller';
import { OrganizationProjectsService } from './organization-projects.service';
import { CqrsModule } from '@nestjs/cqrs';
import { CommandHandlers } from './commands/handlers';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationProject, User]),
		CqrsModule,
		TenantModule
	],
	controllers: [OrganizationProjectsController],
	providers: [OrganizationProjectsService, UserService, ...CommandHandlers],
	exports: [OrganizationProjectsService]
})
export class OrganizationProjectsModule {}
