import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbListModule,
	NbTabsetModule,
	NbTagModule,
	NbUserModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import {
	ImageUploaderModule,
	PublicPageEmployeeMutationModule,
	SharedModule,
	TableComponentsModule,
	WorkInProgressModule
} from '@gauzy/ui-core/shared';
import { EmployeeRoutingModule } from './employee-routing.module';
import { EmployeeComponent } from './employee.component';

@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbListModule,
		NbTabsetModule,
		NbTagModule,
		NbUserModule,
		SharedModule,
		EmployeeRoutingModule,
		ImageUploaderModule,
		PublicPageEmployeeMutationModule,
		TranslateModule.forChild(),
		WorkInProgressModule,
		TableComponentsModule
	],
	declarations: [EmployeeComponent]
})
export class EmployeeModule {}
