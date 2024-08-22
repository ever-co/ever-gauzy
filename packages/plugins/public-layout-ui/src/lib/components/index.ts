import { EmployeeComponent } from './employee/employee.component';
import { PublicPageEmployeeMutationComponent } from './mutation/public-page-employee-mutation/public-page-employee-mutation.component';
import { PublicPageOrganizationMutationComponent } from './mutation/public-page-organization-mutation/public-page-organization-mutation.component';
import { OrganizationComponent } from './organization/organization.component';
import { PublicLayoutComponent } from './public-layout.component';

export const COMPONENTS = [
	PublicLayoutComponent,
	OrganizationComponent,
	EmployeeComponent,
	PublicPageOrganizationMutationComponent,
	PublicPageEmployeeMutationComponent
];
