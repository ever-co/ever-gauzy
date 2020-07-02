import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbDialogModule } from '@nebular/theme';
import { GalleryComponent } from './gallery.component';
import { GalleryDirective } from './gallery.directive';

@NgModule({
	imports: [CommonModule, NbButtonModule, NbDialogModule],
	exports: [GalleryDirective, GalleryComponent],
	declarations: [GalleryDirective, GalleryComponent]
})
export class GalleryModule {}
