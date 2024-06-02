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
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { MomentModule } from 'ngx-moment';
import { EmployeeMultiSelectModule } from '../../../@shared/employee/employee-multi-select/employee-multi-select.module';
import { SharedModule } from '../../../@shared/shared.module';
import { StatusBadgeModule } from '../../../@shared/status-badge/status-badge.module';
import { DialogsModule } from '../../../@shared/dialogs';
import { AddEditProposalTemplateComponent } from './add-edit-proposal-template/add-edit-proposal-template.component';
import { CKEditorModule } from 'ckeditor4-angular';
import { HeaderTitleModule } from '../../../@shared/components/header-title/header-title.module';
import { NbTabsetModule } from '@nebular/theme';
import { GauzyButtonActionModule } from '../../../@shared/gauzy-button-action/gauzy-button-action.module';
import { PaginationV2Module } from '../../../@shared/pagination/pagination-v2/pagination-v2.module';

@NgModule({
	declarations: [ProposalTemplateComponent, AddEditProposalTemplateComponent],
	imports: [
		CommonModule,
		ProposalTemplateRoutingModule,
		I18nTranslateModule.forChild(),
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
		NbTooltipModule,
		NbButtonModule,
		EmployeeMultiSelectModule,
		Angular2SmartTableModule,
		StatusBadgeModule,
		NbToggleModule,
		DialogsModule,
		CKEditorModule,
		HeaderTitleModule,
		NbTabsetModule,
		GauzyButtonActionModule,
		PaginationV2Module
	]
})
export class ProposalTemplateModule {}
