import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbDialogModule, NbIconModule } from '@nebular/theme';
import { GalleryComponent } from './gallery.component';
import { GalleryDirective } from './gallery.directive';
import { GalleryContainerDirective } from './gallery-container.directive';

@NgModule({
	imports: [CommonModule, NbButtonModule, NbDialogModule, NbIconModule],
	exports: [GalleryDirective, GalleryContainerDirective, GalleryComponent],
	declarations: [
		GalleryDirective,
		GalleryContainerDirective,
		GalleryComponent
	]
})
export class GalleryModule {}
