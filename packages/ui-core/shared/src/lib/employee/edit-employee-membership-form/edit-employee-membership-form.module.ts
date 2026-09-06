import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbButtonModule, NbIconModule, NbTooltipModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { EditEmployeeMembershipFormComponent } from './edit-employee-membership-form.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NgSelectModule,
		NbIconModule,
		// `NbCardModule` and `NbActionsModule` went with the rebuild: the component
		// no longer nests a card per list row inside a card, and the remove control
		// is a labelled ghost button rather than an `nb-action` from a toolbar.
		NbTooltipModule,
		TranslateModule.forChild()
	],
	exports: [EditEmployeeMembershipFormComponent],
	declarations: [EditEmployeeMembershipFormComponent]
})
export class EditEmployeeMembershipFormModule {}
