import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { OrganizationBelongsToUserConstraint } from '../shared/validators/constraints/organization-belongs-to-user.constraint';
import { UserOrganizationModule } from '../user-organization/user-organization.module';
import { EmployeeAgentProfile } from './employee-agent-profile.entity';
import { EmployeeAgentProfileController } from './employee-agent-profile.controller';
import { EmployeeAgentProfileService } from './employee-agent-profile.service';
import { TypeOrmEmployeeAgentProfileRepository } from './repository/type-orm-employee-agent-profile.repository';
import { MikroOrmEmployeeAgentProfileRepository } from './repository/mikro-orm-employee-agent-profile.repository';

/**
 * The agent profile of an agent employee (`employee.kind = 'agent'`), one row per employee.
 *
 * `RolePermissionModule` is imported for the guards: a guard is a provider of whichever module hosts the
 * handler it protects, so the permission guard on the controller resolves its lookup from this module.
 * `UserOrganizationModule` and the membership constraint are for the controller's organization check.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([EmployeeAgentProfile]),
		MikroOrmModule.forFeature([EmployeeAgentProfile]),
		RolePermissionModule,
		forwardRef(() => UserOrganizationModule)
	],
	controllers: [EmployeeAgentProfileController],
	providers: [
		EmployeeAgentProfileService,
		OrganizationBelongsToUserConstraint,
		TypeOrmEmployeeAgentProfileRepository,
		MikroOrmEmployeeAgentProfileRepository
	],
	exports: [
		EmployeeAgentProfileService,
		TypeOrmEmployeeAgentProfileRepository,
		MikroOrmEmployeeAgentProfileRepository
	]
})
export class EmployeeAgentProfileModule {}
