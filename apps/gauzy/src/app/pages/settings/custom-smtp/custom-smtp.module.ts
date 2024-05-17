import { NgModule } from '@angular/core';
import { NbCardModule, NbRouteTabsetModule } from '@nebular/theme';
import { ThemeModule } from '../../../@theme/theme.module';
import { CustomSmtpComponent } from './custom-smtp.component';
import { CustomSmtpRoutingModule } from './custom-smtp-routing.module';
import { SMTPModule } from '../../../@shared/smtp/smtp.module';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';

@NgModule({
	imports: [CustomSmtpRoutingModule, ThemeModule, NbCardModule, NbRouteTabsetModule, TranslateModule, SMTPModule],
	declarations: [CustomSmtpComponent],
	providers: []
})
export class CustomSmtpModule {}
