import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationProjects } from './organization-projects.entity';
import { OrganizationProjectsController } from './organization-projects.controller';
import { OrganizationProjectsService } from './organization-projects.service';
import { CqrsModule } from '@nestjs/cqrs';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [TypeOrmModule.forFeature([OrganizationProjects]), CqrsModule],
	controllers: [OrganizationProjectsController],
	providers: [OrganizationProjectsService, ...CommandHandlers],
	exports: [OrganizationProjectsService]
})
export class OrganizationProjectsModule {}
