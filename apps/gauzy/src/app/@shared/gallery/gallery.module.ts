import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbDialogModule, NbIconModule } from '@nebular/theme';
import { GalleryComponent } from './gallery.component';
import { GalleryDirective } from './gallery.directive';

@NgModule({
	imports: [CommonModule, NbButtonModule, NbDialogModule, NbIconModule],
	exports: [GalleryDirective, GalleryComponent],
	declarations: [GalleryDirective, GalleryComponent]
})
export class GalleryModule {}
