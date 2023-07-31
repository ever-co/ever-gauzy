import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SpinnerButtonDirective } from './spinner-button.directive';
import { NbSpinnerModule } from '@nebular/theme';



@NgModule({
	declarations: [SpinnerButtonDirective],
	exports: [SpinnerButtonDirective],
	imports: [
		CommonModule,
		NbSpinnerModule
	]
})
export class DesktopDirectiveModule { }
