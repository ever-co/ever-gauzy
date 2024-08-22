import { NgModule } from '@angular/core';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbListModule,
	NbMenuModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbTagModule,
	NbToastrModule,
	NbUserModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import {
	ImageUploaderModule,
	MiscellaneousModule,
	PublicPageEmployeeMutationModule,
	PublicPageMutationModule,
	SharedModule,
	TableComponentsModule,
	WorkInProgressModule
} from '@gauzy/ui-core/shared';
import { ThemeModule } from '@gauzy/ui-core/theme';
import { ShareComponent } from './share.component';
import { ShareRoutingModule } from './share-routing.module';
import { OrganizationComponent } from './organization/organization.component';
import { EmployeeComponent } from './employee/employee.component';

// Nebular Modules
const NB_MODULES = [
	NbButtonModule,
	NbCardModule,
	NbDialogModule.forChild(),
	NbIconModule,
	NbInputModule,
	NbListModule,
	NbMenuModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbTagModule,
	NbToastrModule.forRoot(),
	NbUserModule
];

@NgModule({
	imports: [
		...NB_MODULES,
		TranslateModule.forChild(),
		ShareRoutingModule,
		MiscellaneousModule,
		ThemeModule,
		SharedModule,
		PublicPageMutationModule,
		PublicPageEmployeeMutationModule,
		TableComponentsModule,
		WorkInProgressModule,
		ImageUploaderModule
	],
	declarations: [ShareComponent, OrganizationComponent, EmployeeComponent],
	providers: []
})
export class ShareModule {}
