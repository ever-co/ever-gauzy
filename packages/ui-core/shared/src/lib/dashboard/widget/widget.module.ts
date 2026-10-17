import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbIconModule, NbPopoverModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { WidgetComponent } from './widget.component';
import { WidgetTemplateDirective } from './widget-template.directive';
import { SharedModule } from '../../shared.module';

@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbIconModule,
		NbPopoverModule,
		TranslatePipe,
		SharedModule,
		WidgetTemplateDirective
	],
	declarations: [WidgetComponent],
	exports: [WidgetComponent, WidgetTemplateDirective]
})
export class WidgetModule {}
