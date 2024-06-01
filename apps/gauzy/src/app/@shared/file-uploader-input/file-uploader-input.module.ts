import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbButtonModule, NbSpinnerModule } from '@nebular/theme';
import { FileUploadModule } from 'ng2-file-upload';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { FileUploaderInputComponent } from './file-uploader-input.component';
import { DirectivesModule } from '../directives/directives.module';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		I18nTranslateModule.forChild(),
		FileUploadModule,
		NbButtonModule,
		NbSpinnerModule,
		DirectivesModule
	],
	exports: [FileUploaderInputComponent],
	declarations: [FileUploaderInputComponent]
})
export class FileUploaderModule {}
