import { NgModule } from '@angular/core';
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
import { MomentModule } from 'ngx-moment';
import { CKEditorModule } from 'ckeditor4-angular';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import {
	SmartDataViewLayoutModule,
	DialogsModule,
	EmployeeMultiSelectModule,
	SharedModule,
	StatusBadgeModule
} from '@gauzy/ui-core/shared';
import { ProposalTemplateRoutingModule } from './proposal-template-routing.module';
import { ProposalTemplateComponent } from './proposal-template/proposal-template.component';
import { AddEditProposalTemplateComponent } from './add-edit-proposal-template/add-edit-proposal-template.component';

@NgModule({
	declarations: [ProposalTemplateComponent, AddEditProposalTemplateComponent],
	imports: [
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
		TranslateModule.forChild(),
		ProposalTemplateRoutingModule,
		SharedModule,
		EmployeeMultiSelectModule,
		StatusBadgeModule,
		DialogsModule,
		SmartDataViewLayoutModule
	]
})
export class ProposalTemplateModule {}
