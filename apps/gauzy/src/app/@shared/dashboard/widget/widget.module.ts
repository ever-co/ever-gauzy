import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WidgetComponent } from './widget.component';
import { NgxDraggableDomModule } from 'ngx-draggable-dom';
import { NbButtonModule, NbIconModule, NbPopoverModule } from '@nebular/theme';

@NgModule({
	declarations: [WidgetComponent],
	imports: [
		CommonModule,
		NgxDraggableDomModule,
		NbIconModule,
		NbPopoverModule,
		NbButtonModule
	],
	exports: [WidgetComponent]
})
export class WidgetModule {}
