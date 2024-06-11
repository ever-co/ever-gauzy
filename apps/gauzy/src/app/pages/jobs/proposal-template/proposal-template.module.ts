import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbIconModule,
	NbSpinnerModule,
	NbCardModule,
	NbInputModule,
	NbSelectModule,
	NbTooltipModule,
	NbButtonModule,
	NbToggleModule,
	NbTabsetModule
} from '@nebular/theme';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { MomentModule } from 'ngx-moment';
import { CKEditorModule } from 'ckeditor4-angular';
import { NgxPermissionsModule } from 'ngx-permissions';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import {
	DialogsModule,
	EmployeeMultiSelectModule,
	GauzyButtonActionModule,
	PaginationV2Module,
	SharedModule
} from '@gauzy/ui-sdk/shared';
import { ProposalTemplateRoutingModule } from './proposal-template-routing.module';
import { ProposalTemplateComponent } from './proposal-template/proposal-template.component';
import { StatusBadgeModule } from '../../../@shared/status-badge/status-badge.module';
import { AddEditProposalTemplateComponent } from './add-edit-proposal-template/add-edit-proposal-template.component';

@NgModule({
	declarations: [ProposalTemplateComponent, AddEditProposalTemplateComponent],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		Angular2SmartTableModule,
		CKEditorModule,
		MomentModule,
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		NbInputModule,
		NbSelectModule,
		NbTooltipModule,
		NbButtonModule,
		NbToggleModule,
		NbTabsetModule,
		NgxPermissionsModule.forChild(),
		I18nTranslateModule.forChild(),
		ProposalTemplateRoutingModule,
		SharedModule,
		EmployeeMultiSelectModule,
		StatusBadgeModule,
		DialogsModule,
		GauzyButtonActionModule,
		PaginationV2Module
	]
})
export class ProposalTemplateModule {}
