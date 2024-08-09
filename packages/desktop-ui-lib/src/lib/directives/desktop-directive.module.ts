import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NbSpinnerModule } from '@nebular/theme';
import { DynamicDirective } from './dynamic.directive';
import { SpinnerButtonDirective } from './spinner-button.directive';

@NgModule({
	declarations: [SpinnerButtonDirective, DynamicDirective],
	exports: [SpinnerButtonDirective, DynamicDirective],
	imports: [CommonModule, NbSpinnerModule]
})
export class DesktopDirectiveModule {}
