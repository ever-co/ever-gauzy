import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbActionsModule,
	NbButtonModule,
	NbCardModule,
	NbIconModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpLoaderFactory, ThemeModule } from '../../../@theme/theme.module';
import { EditEmployeeMembershipFormComponent } from './edit-employee-membership-form.component';
@NgModule({
	imports: [
		ThemeModule,
		FormsModule,
		ReactiveFormsModule,
		NbCardModule,
		NbButtonModule,
		NgSelectModule,
		NbIconModule,
		NbActionsModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	exports: [EditEmployeeMembershipFormComponent],
	declarations: [EditEmployeeMembershipFormComponent],
	entryComponents: [EditEmployeeMembershipFormComponent],
	providers: []
})
export class EditEmployeeMembershipFormModule {}
