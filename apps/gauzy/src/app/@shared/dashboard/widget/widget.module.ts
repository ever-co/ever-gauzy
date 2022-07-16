import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WidgetComponent } from './widget.component';
import { NgxDraggableDomModule } from 'ngx-draggable-dom';
import { NbButtonModule, NbIconModule, NbPopoverModule } from '@nebular/theme';
import { SharedModule } from '../../shared.module';

@NgModule({
	declarations: [WidgetComponent],
	imports: [
		CommonModule,
		NgxDraggableDomModule,
		NbIconModule,
		NbPopoverModule,
		NbButtonModule,
		SharedModule
	],
	exports: [WidgetComponent]
})
export class WidgetModule {}
