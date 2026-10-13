import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbRouteTabsetModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { SharedModule, SMTPModule } from '@gauzy/ui-core/shared';
import { CustomSmtpComponent } from './custom-smtp.component';
import { CustomSmtpRoutingModule } from './custom-smtp-routing.module';

@NgModule({
	imports: [
		CommonModule,
		NbCardModule,
		NbRouteTabsetModule,
		TranslatePipe,
		CustomSmtpRoutingModule,
		SharedModule,
		SMTPModule
	],
	declarations: [CustomSmtpComponent]
})
export class CustomSmtpModule {}
