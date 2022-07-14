import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WidgetComponent } from './widget.component';
import { NgxDraggableDomModule } from 'ngx-draggable-dom';

@NgModule({
	declarations: [WidgetComponent],
	imports: [CommonModule, NgxDraggableDomModule],
	exports: [WidgetComponent]
})
export class WidgetModule {}
