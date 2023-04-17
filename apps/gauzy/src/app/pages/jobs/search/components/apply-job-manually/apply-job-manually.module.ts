import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { NbButtonModule, NbCardModule, NbFormFieldModule, NbIconModule, NbInputModule } from '@nebular/theme';
import { CKEditorModule } from 'ckeditor4-angular';
import { FileUploadModule } from 'ng2-file-upload';
import { ApplyJobManuallyComponent } from './apply-job-manually.component';
import { TranslateModule } from './../../../../../@shared/translate/translate.module';
import { EmployeeMultiSelectModule } from './../../../../../@shared/employee/employee-multi-select/employee-multi-select.module';
import { ProposalTemplateSelectModule } from './../../../../../@shared/proposal-template-select/proposal-template-select.module';

@NgModule({
	providers: [],
	declarations: [
		ApplyJobManuallyComponent
	],
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
		TranslateModule,
		EmployeeMultiSelectModule,
		ProposalTemplateSelectModule
	],
	exports: []
})
export class ApplyJobManuallyModule { }
