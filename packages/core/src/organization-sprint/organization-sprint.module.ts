import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { OrganizationSprintService } from './organization-sprint.service';
import { OrganizationSprintController } from './organization-sprint.controller';
import { OrganizationSprint } from './organization-sprint.entity';
import { Task } from '../tasks/task.entity';
import { CommandHandlers } from './commands/handlers';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from '../user/user.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/organization-sprint', module: OrganizationSprintModule }
		]),
		TypeOrmModule.forFeature([OrganizationSprint, Task]),
		CqrsModule,
		TenantModule,
		UserModule
	],
	controllers: [OrganizationSprintController],
	providers: [OrganizationSprintService, ...CommandHandlers],
	exports: [OrganizationSprintService]
})
export class OrganizationSprintModule {}
