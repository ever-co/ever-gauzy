import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbIconModule, NbPopoverModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { SharedModule } from '../../shared.module';
import { WindowComponent } from '../window/window.component';
import { WindowTemplateDirective } from './window-template.directive';

@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbIconModule,
		NbPopoverModule,
		TranslatePipe,
		SharedModule,
		WindowTemplateDirective
	],
	declarations: [WindowComponent],
	exports: [WindowComponent, WindowTemplateDirective]
})
export class WindowModule {}
