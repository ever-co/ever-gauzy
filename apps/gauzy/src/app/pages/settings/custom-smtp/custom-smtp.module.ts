import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbRouteTabsetModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-core/i18n';
import { SMTPModule } from '@gauzy/ui-core/shared';
import { CustomSmtpComponent } from './custom-smtp.component';
import { CustomSmtpRoutingModule } from './custom-smtp-routing.module';

@NgModule({
	imports: [CommonModule, NbCardModule, NbRouteTabsetModule, TranslateModule, CustomSmtpRoutingModule, SMTPModule],
	declarations: [CustomSmtpComponent]
})
export class CustomSmtpModule {}
