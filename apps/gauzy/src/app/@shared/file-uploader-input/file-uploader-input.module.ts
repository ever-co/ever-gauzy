import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FileUploadModule } from 'ng2-file-upload';
import { FileUploaderInputComponent } from './file-uploader-input.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbButtonModule, NbSpinnerModule } from '@nebular/theme';
import { DirectivesModule } from '../directives/directives.module';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		TranslateModule.forChild(),
		FileUploadModule,
		NbButtonModule,
		NbSpinnerModule,
		DirectivesModule
	],
	exports: [FileUploaderInputComponent],
	declarations: [FileUploaderInputComponent]
})
export class FileUploaderModule { }
