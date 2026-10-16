import { Module } from '@nestjs/common';
import { UserOrganizationModule } from '../../user-organization/user-organization.module';
import { RoleModule } from '../../role/role.module';
import { EmployeeModule } from '../../employee/employee.module';
import { ExpenseCategoriesModule } from '../../expense-categories/expense-categories.module';
import { OrganizationTeamModule } from '../../organization-team/organization-team.module';
import {
	TenantBelongsToUserConstraint,
	RoleAlreadyExistConstraint,
	RoleShouldExistConstraint,
	EmployeeBelongsToOrganizationConstraint,
	TeamAlreadyExistConstraint,
	ExpenseCategoryAlreadyExistConstraint,
	OrganizationBelongsToUserConstraint
} from './constraints';

@Module({
	imports: [EmployeeModule, UserOrganizationModule, RoleModule, ExpenseCategoriesModule, OrganizationTeamModule],
	providers: [
		TenantBelongsToUserConstraint,
		RoleAlreadyExistConstraint,
		RoleShouldExistConstraint,
		EmployeeBelongsToOrganizationConstraint,
		TeamAlreadyExistConstraint,
		ExpenseCategoryAlreadyExistConstraint,
		OrganizationBelongsToUserConstraint
	],
	// The GraphQL surface runs no class-validator, so the organization-membership interceptor (R7-03) makes the
	// same lookup this constraint makes for the REST DTOs — one rule, one implementation.
	exports: [OrganizationBelongsToUserConstraint, EmployeeBelongsToOrganizationConstraint]
})
export class ValidatorModule {}
