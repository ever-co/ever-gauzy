import { NgModule } from '@angular/core';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbListModule,
	NbUserModule,
	NbTabsetModule,
	NbTagModule
} from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { TableComponentsModule } from '@gauzy/ui-sdk/shared';
import { EmployeeRoutingModule } from './employee-routing.module';
import { ImageUploaderModule } from '../../@shared/image-uploader/image-uploader.module';
import { EmployeeComponent } from './employee.component';
import { PublicPageEmployeeMutationModule } from '../../@shared/employee/public-page-employee-mutation/public-page-employee-mutation.module';
import { WorkInProgressModule } from '../../pages/work-in-progress/work-in-progress.module';
import { SharedModule } from '../../@shared/shared.module';

@NgModule({
	imports: [
		SharedModule,
		EmployeeRoutingModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NbInputModule,
		ImageUploaderModule,
		PublicPageEmployeeMutationModule,
		I18nTranslateModule.forChild(),
		NbListModule,
		NbUserModule,
		NbTabsetModule,
		NbTagModule,
		WorkInProgressModule,
		TableComponentsModule
	],
	declarations: [EmployeeComponent],
	providers: []
})
export class EmployeeModule {}
