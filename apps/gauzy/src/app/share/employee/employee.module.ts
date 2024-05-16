import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
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
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { EmployeeRoutingModule } from './employee-routing.module';
import { ImageUploaderModule } from '../../@shared/image-uploader/image-uploader.module';
import { EmployeeComponent } from './employee.component';
import { PublicPageEmployeeMutationModule } from '../../@shared/employee/public-page-employee-mutation/public-page-employee-mutation.module';
import { WorkInProgressModule } from '../../pages/work-in-progress/work-in-progress.module';
import { SharedModule } from '../../@shared/shared.module';
import { TableComponentsModule } from '../../@shared';

@NgModule({
	imports: [
		ThemeModule,
		SharedModule,
		EmployeeRoutingModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NbInputModule,
		ImageUploaderModule,
		PublicPageEmployeeMutationModule,
		TranslateModule,
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
