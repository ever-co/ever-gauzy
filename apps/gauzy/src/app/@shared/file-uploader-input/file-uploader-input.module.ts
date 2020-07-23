import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FileUploadModule } from 'ng2-file-upload';
import { FileUploaderInputComponent } from './file-uploader-input.component';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbSpinnerModule } from '@nebular/theme';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		TranslateModule.forChild(),
		FileUploadModule,
		NbButtonModule,
		NbSpinnerModule
	],
	exports: [FileUploaderInputComponent],
	declarations: [FileUploaderInputComponent]
})
export class FileUploaderModule {}
