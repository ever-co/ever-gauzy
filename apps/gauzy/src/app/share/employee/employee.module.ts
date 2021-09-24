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
import { EmployeeRoutingModule } from './employee-routing.module';
import { ImageUploaderModule } from '../../@shared/image-uploader/image-uploader.module';
import { EmployeeComponent } from './employee.component';
import { PublicPageEmployeeMutationModule } from '../../@shared/employee/public-page-employee-mutation/public-page-employee-mutation.module';
import { TranslateModule } from '../../@shared/translate/translate.module';

@NgModule({
	imports: [
		ThemeModule,
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
		NbTagModule
	],
	declarations: [EmployeeComponent],
	providers: []
})
export class EmployeeModule {}
