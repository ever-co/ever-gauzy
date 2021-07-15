import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ProposalTemplateRoutingModule } from './proposal-template-routing.module';
import { ProposalTemplateComponent } from './proposal-template/proposal-template.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbIconModule,
	NbSpinnerModule,
	NbCardModule,
	NbInputModule,
	NbSelectModule,
	NbButtonModule,
	NbToggleModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { MomentModule } from 'ngx-moment';
import { EmployeeMultiSelectModule } from '../../../@shared/employee/employee-multi-select/employee-multi-select.module';
import { SharedModule } from '../../../@shared/shared.module';
import { StatusBadgeModule } from '../../../@shared/status-badge/status-badge.module';
import { DialogsModule } from '../../../@shared/dialogs';
import { AddEditProposalTemplateComponent } from './add-edit-proposal-template/add-edit-proposal-template.component';
import { CKEditorModule } from 'ng2-ckeditor';
import { HeaderTitleModule } from '../../../@shared/components/header-title/header-title.module';

@NgModule({
	declarations: [ProposalTemplateComponent, AddEditProposalTemplateComponent],
	imports: [
		CommonModule,
		ProposalTemplateRoutingModule,
		TranslateModule,
		ReactiveFormsModule,
		FormsModule,
		SharedModule,
		NbIconModule,
		NbSpinnerModule,
		MomentModule,
		NbCardModule,
		NbInputModule,
		FormsModule,
		NbSelectModule,
		NbButtonModule,
		EmployeeMultiSelectModule,
		Ng2SmartTableModule,
		StatusBadgeModule,
		NbToggleModule,
		DialogsModule,
		CKEditorModule,
		HeaderTitleModule
	]
})
export class ProposalTemplateModule {}
