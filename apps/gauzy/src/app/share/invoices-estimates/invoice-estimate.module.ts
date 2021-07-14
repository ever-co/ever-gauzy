import { NgModule } from '@angular/core';
import { InvoiceEstimateRoutingModule } from './invoice-estimate.routing.module';
import { InvoiceEstimateComponent } from './invoice-estimate.component';
import { InvoicesService } from '../../@core/services/invoices.service';
import { CommonModule } from '@angular/common';
import { InvoicesModule } from '../../pages/invoices/invoices.module';
import { NbCardModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
	imports: [
		InvoiceEstimateRoutingModule,
		InvoicesModule,
		CommonModule,
		NbCardModule,
		TranslateModule
	],
	declarations: [InvoiceEstimateComponent],
	exports: [InvoiceEstimateComponent],
	providers: [InvoicesService]
})
export class InvoiceEstimateModule {}
