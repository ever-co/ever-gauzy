import { NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NbCardModule, NbRouteTabsetModule } from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpLoaderFactory, ThemeModule } from '../../../@theme/theme.module';
import { CustomSmtpComponent } from './custom-smtp.component';
import { CustomSmtpRoutingModule } from './custom-smtp-routing.module';
import { SMTPModule } from '../../../@shared/smtp/smtp.module';

@NgModule({
	imports: [
		CustomSmtpRoutingModule,
		ThemeModule,
		NbCardModule,
		NbRouteTabsetModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		SMTPModule
	],
	declarations: [CustomSmtpComponent],
	providers: []
})
export class CustomSmtpModule {}
