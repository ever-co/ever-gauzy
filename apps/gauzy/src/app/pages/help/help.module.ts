import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbButtonModule, NbInputModule } from '@nebular/theme';
import { HelpComponent } from './help.component';
import { HelpRoutingModule } from './help-routing.module';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';

@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbCardModule,
		NbInputModule,
		I18nTranslateModule.forChild(),
		HelpRoutingModule
	],
	declarations: [HelpComponent]
})
export class HelpModule {}
