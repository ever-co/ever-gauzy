import { DragDropModule } from '@angular/cdk/drag-drop';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WindowModule } from '../window/window.module';
import { WindowLayoutComponent } from './window-layout.component';

@NgModule({
	declarations: [WindowLayoutComponent],
	imports: [CommonModule, WindowModule, DragDropModule],
	exports: [WindowLayoutComponent, WindowModule]
})
export class WindowLayoutModule {}
