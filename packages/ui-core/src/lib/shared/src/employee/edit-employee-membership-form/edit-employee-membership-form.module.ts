import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbActionsModule, NbButtonModule, NbCardModule, NbIconModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { EditEmployeeMembershipFormComponent } from './edit-employee-membership-form.component';

@NgModule({
	imports: [
		CommonModule,
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
	declarations: [EditEmployeeMembershipFormComponent]
})
export class EditEmployeeMembershipFormModule {}
