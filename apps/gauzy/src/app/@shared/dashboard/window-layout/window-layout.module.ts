import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WindowModule } from '../window/window.module';
import { WindowLayoutComponent } from './window-layout.component';
import { DragDropModule } from '@angular/cdk/drag-drop';

@NgModule({
	declarations: [WindowLayoutComponent],
	imports: [CommonModule, WindowModule, DragDropModule],
	exports: [WindowLayoutComponent]
})
export class WindowLayoutModule {}
