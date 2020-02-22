import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationProjects } from './organization-projects.entity';
import { OrganizationProjectsController } from './organization-projects.controller';
import { OrganizationProjectsService } from './organization-projects.service';
import { CqrsModule } from '@nestjs/cqrs';
import { CommandHandlers } from './commands/handlers';
import { User, UserService } from '../user';

@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationProjects, User]),
		CqrsModule
	],
	controllers: [OrganizationProjectsController],
	providers: [OrganizationProjectsService, UserService, ...CommandHandlers],
	exports: [OrganizationProjectsService]
})
export class OrganizationProjectsModule {}
