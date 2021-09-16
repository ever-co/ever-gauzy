import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { UserOrganizationModule } from './../user-organization/user-organization.module';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';
import { RoleModule } from './../role/role.module';
import { CommandHandlers } from './commands/handlers';
import { OrganizationController } from './organization.controller';
import { Organization } from './organization.entity';
import { OrganizationService } from './organization.service';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/organization', module: OrganizationModule }
		]),
		TypeOrmModule.forFeature([ Organization ]),
		forwardRef(() => TenantModule),
		forwardRef(() => UserOrganizationModule),
		forwardRef(() => UserModule),
		forwardRef(() => RoleModule),
		CqrsModule,
	],
	controllers: [OrganizationController],
	providers: [
		OrganizationService,
		...CommandHandlers
	],
	exports: [
		TypeOrmModule,
		OrganizationService
	]
})
export class OrganizationModule {}
