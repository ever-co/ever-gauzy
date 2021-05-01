import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrganizationTitleComponent } from './organization/organization-title.component';
import { EmployeeTitleComponent } from './employee/employee-title.component';

@NgModule({
	imports: [
		CommonModule
	],
	declarations: [
		OrganizationTitleComponent,
		EmployeeTitleComponent
	],
	exports: [
		OrganizationTitleComponent,
		EmployeeTitleComponent
	]
})
export class HeaderTitleModule {}
