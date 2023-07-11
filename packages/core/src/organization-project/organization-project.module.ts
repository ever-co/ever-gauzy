import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { CqrsModule } from '@nestjs/cqrs';
import { OrganizationProject } from './organization-project.entity';
import { OrganizationProjectController } from './organization-project.controller';
import { OrganizationProjectService } from './organization-project.service';
import { CommandHandlers } from './commands/handlers';
import { UserModule } from './../user/user.module';
import { TenantModule } from '../tenant/tenant.module';
import { OrganizationContactModule } from './../organization-contact/organization-contact.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/organization-projects',
				module: OrganizationProjectModule,
			},
		]),
		TypeOrmModule.forFeature([
			OrganizationProject
		]),
		forwardRef(() => TenantModule),
		forwardRef(() => UserModule),
		forwardRef(() => OrganizationContactModule),
		CqrsModule,
	],
	controllers: [OrganizationProjectController],
	providers: [
		OrganizationProjectService,
		...CommandHandlers
	],
	exports: [
		TypeOrmModule,
		OrganizationProjectService
	],
})
export class OrganizationProjectModule { }
