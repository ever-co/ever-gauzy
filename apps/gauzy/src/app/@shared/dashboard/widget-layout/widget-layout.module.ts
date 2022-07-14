import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WidgetLayoutComponent } from './widget-layout.component';
import { WidgetModule } from '../widget/widget.module';
import { DragDropModule } from '@angular/cdk/drag-drop';

@NgModule({
	declarations: [WidgetLayoutComponent],
	imports: [CommonModule, WidgetModule, DragDropModule],
	exports: [WidgetLayoutComponent]
})
export class WidgetLayoutModule {}
