import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NbSpinnerModule } from '@nebular/theme';
import { DebounceClickDirective } from './debounce-click.directive';
import { DynamicDirective } from './dynamic.directive';
import { SpinnerButtonDirective } from './spinner-button.directive';
import { TextMaskDirective } from './text-mask.directive';

@NgModule({
	declarations: [SpinnerButtonDirective, DynamicDirective, TextMaskDirective, DebounceClickDirective],
	exports: [SpinnerButtonDirective, DynamicDirective, TextMaskDirective, DebounceClickDirective],
	imports: [CommonModule, NbSpinnerModule]
})
export class DesktopDirectiveModule {}
