import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CustomSmtpRoutingModule } from './custom-smtp-routing.module';
import { CustomSmtpComponent as OrganizationCustomSmtpComponent } from './custom-smtp.component';
import { HttpClient } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { NbCardModule, NbSpinnerModule } from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { SMTPModule } from '../../@shared/smtp/smtp.module';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	declarations: [OrganizationCustomSmtpComponent],
	imports: [
		CommonModule,
		CustomSmtpRoutingModule,
		NbCardModule,
		NbSpinnerModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		SMTPModule
	]
})
export class CustomSmtpModule {}
