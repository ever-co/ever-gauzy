import { OrganizationSprintService } from './organization-sprint.service';
import { OrganizationSprintController } from './organization-sprint.controller';
import { OrganizationSprint } from './organization-sprint.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { User } from '../user/user.entity';
import { Task } from '../tasks/task.entity';
import { CqrsModule } from '@nestjs/cqrs';
import { UserService } from '../user/user.service';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [TypeOrmModule.forFeature([OrganizationSprint,User,Task]),
    CqrsModule],
	controllers: [OrganizationSprintController],
	providers: [OrganizationSprintService,UserService, ...CommandHandlers],
	exports: [OrganizationSprintService]
})
export class OrganizationSprintModule {}
