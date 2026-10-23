import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbButtonModule, NbIconModule, NbTooltipModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslatePipe } from '@ngx-translate/core';
import { EditEmployeeMembershipFormComponent } from './edit-employee-membership-form.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NgSelectModule,
		NbIconModule,
		NbTooltipModule,
		TranslatePipe
	],
	exports: [EditEmployeeMembershipFormComponent],
	declarations: [EditEmployeeMembershipFormComponent]
})
export class EditEmployeeMembershipFormModule {}
