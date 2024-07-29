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
	TableComponentsModule
} from '@gauzy/ui-core/shared';
import { EmployeeRoutingModule } from './employee-routing.module';
import { EmployeeComponent } from './employee.component';
import { WorkInProgressModule } from '../../pages/work-in-progress/work-in-progress.module';

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
