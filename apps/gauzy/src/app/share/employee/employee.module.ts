import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbListModule,
	NbUserModule,
	NbTabsetModule
} from '@nebular/theme';
import { EmployeeRoutingModule } from './employee-routing.module';
import { ImageUploaderModule } from '../../@shared/image-uploader/image-uploader.module';
import { EmployeeComponent } from './employee.component';
import { PublicPageEmployeeMutationModule } from '../../@shared/employee/public-page-employee-mutation/public-page-employee-mutation.module';
import { TranslaterModule } from '../../@shared/translater/translater.module';

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
		TranslaterModule,
		NbListModule,
		NbUserModule,
		NbTabsetModule
	],
	declarations: [EmployeeComponent],
	entryComponents: [],
	providers: []
})
export class EmployeeModule {}
