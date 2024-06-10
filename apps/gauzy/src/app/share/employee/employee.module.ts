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
import { TableComponentsModule } from '@gauzy/ui-sdk/shared';
import { ImageUploaderModule } from '../../@shared/image-uploader/image-uploader.module';
import { SharedModule } from '../../@shared/shared.module';
import { EmployeeRoutingModule } from './employee-routing.module';
import { EmployeeComponent } from './employee.component';
import { PublicPageEmployeeMutationModule } from '../../@shared/employee/public-page-employee-mutation/public-page-employee-mutation.module';
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
