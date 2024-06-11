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
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import {
	ImageUploaderModule,
	PublicPageEmployeeMutationModule,
	SharedModule,
	TableComponentsModule
} from '@gauzy/ui-sdk/shared';
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
		I18nTranslateModule.forChild(),
		WorkInProgressModule,
		TableComponentsModule
	],
	declarations: [EmployeeComponent]
})
export class EmployeeModule {}
