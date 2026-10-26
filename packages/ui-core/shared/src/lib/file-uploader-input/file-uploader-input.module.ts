import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbButtonModule, NbSpinnerModule } from '@nebular/theme';
import { FileUploadModule } from 'ng2-file-upload';
import { TranslatePipe } from '@ngx-translate/core';
import { DirectivesModule } from '../directives/directives.module';
import { FileUploaderInputComponent } from './file-uploader-input.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbSpinnerModule,
		TranslatePipe,
		DirectivesModule,
		FileUploadModule
	],
	exports: [FileUploaderInputComponent],
	declarations: [FileUploaderInputComponent]
})
export class FileUploaderModule {}
