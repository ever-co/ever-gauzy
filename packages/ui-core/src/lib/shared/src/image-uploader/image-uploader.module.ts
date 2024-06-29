import { NgModule } from '@angular/core';
import { ImageUploaderComponent } from './image-uploader.component';
import { FileUploadModule } from 'ng2-file-upload';
import { CommonModule } from '@angular/common';

@NgModule({
	imports: [FileUploadModule, CommonModule],
	exports: [ImageUploaderComponent],
	declarations: [ImageUploaderComponent],
	providers: []
})
export class ImageUploaderModule {}
