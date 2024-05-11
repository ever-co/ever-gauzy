import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from './button.component';

@NgModule({
	declarations: [ButtonComponent],
	imports: [CommonModule],
	exports: [ButtonComponent],
	providers: []
})
export class ButtonModule {}
