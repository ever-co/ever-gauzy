import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { CqrsModule } from '@nestjs/cqrs';
import { OrganizationProject } from './organization-project.entity';
import { OrganizationProjectController } from './organization-project.controller';
import { OrganizationProjectService } from './organization-project.service';
import { CommandHandlers } from './commands/handlers';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/organization-projects',
				module: OrganizationProjectModule
			}
		]),
		TypeOrmModule.forFeature([OrganizationProject, User]),
		CqrsModule,
		TenantModule
	],
	controllers: [OrganizationProjectController],
	providers: [OrganizationProjectService, UserService, ...CommandHandlers],
	exports: [OrganizationProjectService]
})
export class OrganizationProjectModule {}
