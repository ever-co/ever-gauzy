import { NgModule } from '@angular/core';
import { EstimateEmailComponent } from './estimate-email.component';
import { InvoicesService } from '../../@core/services/invoices.service';
import { CommonModule } from '@angular/common';
import { EstimateEmailService } from '../../@core/services/estimate-email.service';
import { NbCardModule, NbSpinnerModule } from '@nebular/theme';
import { HttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { HttpLoaderFactory } from '../../@theme/theme.module';

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
