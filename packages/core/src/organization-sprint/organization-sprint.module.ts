import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { OrganizationSprintService } from './organization-sprint.service';
import { OrganizationSprintController } from './organization-sprint.controller';
import { OrganizationSprint } from './organization-sprint.entity';
import { User } from '../user/user.entity';
import { Task } from '../tasks/task.entity';
import { UserService } from '../user/user.service';
import { CommandHandlers } from './commands/handlers';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/organization-sprint', module: OrganizationSprintModule }
		]),
		TypeOrmModule.forFeature([OrganizationSprint, User, Task]),
		CqrsModule,
		TenantModule
	],
	controllers: [OrganizationSprintController],
	providers: [OrganizationSprintService, UserService, ...CommandHandlers],
	exports: [OrganizationSprintService]
})
export class OrganizationSprintModule {}
