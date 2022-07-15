import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WindowComponent } from '../window/window.component';

@NgModule({
	declarations: [WindowComponent],
	exports: [WindowComponent],
	imports: [CommonModule]
})
export class WindowModule {}
