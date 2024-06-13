import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbRouteTabsetModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { SMTPModule } from '@gauzy/ui-sdk/shared';
import { CustomSmtpComponent } from './custom-smtp.component';
import { CustomSmtpRoutingModule } from './custom-smtp-routing.module';

@NgModule({
	imports: [
		CommonModule,
		NbCardModule,
		NbRouteTabsetModule,
		I18nTranslateModule.forChild(),
		CustomSmtpRoutingModule,
		SMTPModule
	],
	declarations: [CustomSmtpComponent]
})
export class CustomSmtpModule {}
