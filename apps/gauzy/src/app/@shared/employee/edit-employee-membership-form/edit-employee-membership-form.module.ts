import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbActionsModule, NbButtonModule, NbCardModule, NbIconModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../../@theme/theme.module';
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
		I18nTranslateModule.forChild()
	],
	exports: [EditEmployeeMembershipFormComponent],
	declarations: [EditEmployeeMembershipFormComponent],
	providers: []
})
export class EditEmployeeMembershipFormModule {}
