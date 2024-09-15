import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileUploadModule } from 'ng2-file-upload';
import { ImageUploaderComponent } from './image-uploader.component';

@NgModule({
	imports: [CommonModule, FileUploadModule],
	exports: [ImageUploaderComponent],
	declarations: [ImageUploaderComponent]
})
export class ImageUploaderModule {}
