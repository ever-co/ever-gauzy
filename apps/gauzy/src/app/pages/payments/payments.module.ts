import { HttpClient } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { NgModule } from '@angular/core';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { PaymentsComponent } from './payments.component';
import { NbCardModule } from '@nebular/theme';
import { PaymentsRoutingModule } from './payments-routing.module';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { PaymentService } from '../../@core/services/payment.service';
import { OrganizationContactService } from '../../@core/services/organization-contact.service';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
import { ThemeModule } from '../../@theme/theme.module';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	imports: [
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		NbCardModule,
		PaymentsRoutingModule,
		Ng2SmartTableModule,
		CardGridModule,
		ThemeModule
	],
	providers: [PaymentService, OrganizationContactService],
	entryComponents: [PaymentsComponent],
	declarations: [PaymentsComponent]
})
export class PaymentsModule {}
