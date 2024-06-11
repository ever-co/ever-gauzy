import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import {
	NbButtonModule,
	NbCardModule,
	NbFormFieldModule,
	NbIconModule,
	NbInputModule,
	NbSpinnerModule
} from '@nebular/theme';
import { CKEditorModule } from 'ckeditor4-angular';
import { FileUploadModule } from 'ng2-file-upload';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { DirectivesModule } from '@gauzy/ui-sdk/shared';
import { ApplyJobManuallyComponent } from './apply-job-manually.component';
import { JobTableComponentsModule } from '../../../table-components';
import { EmployeeMultiSelectModule } from './../../../../../@shared/employee/employee-multi-select/employee-multi-select.module';
import { ProposalTemplateSelectModule } from './../../../../../@shared/proposal-template-select/proposal-template-select.module';
import { SelectorsModule } from 'apps/gauzy/src/app/@shared/selectors/selectors.module';

@NgModule({
	providers: [],
	declarations: [ApplyJobManuallyComponent],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		CKEditorModule,
		FileUploadModule,
		NbButtonModule,
		NbCardModule,
		NbFormFieldModule,
		NbIconModule,
		NbInputModule,
		NbSpinnerModule,
		I18nTranslateModule.forChild(),
		EmployeeMultiSelectModule,
		ProposalTemplateSelectModule,
		JobTableComponentsModule,
		DirectivesModule,
		SelectorsModule
	],
	exports: []
})
export class ApplyJobManuallyModule {}
