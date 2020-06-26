import { NgModule } from '@angular/core';
import { EstimateEmailComponent } from './estimate-email.component';
import { InvoicesService } from '../../@core/services/invoices.service';
import { CommonModule } from '@angular/common';
import { EstimateEmailService } from '../../@core/services/estimate-email.service';
import { NbCardModule, NbSpinnerModule } from '@nebular/theme';
import { HttpClient } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { TranslateModule } from '@ngx-translate/core';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	imports: [
		CommonModule,
		NbCardModule,
		NbSpinnerModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateModule,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	providers: [InvoicesService, EstimateEmailService],
	entryComponents: [EstimateEmailComponent],
	declarations: [EstimateEmailComponent]
})
export class EstimateEmailModule {}
