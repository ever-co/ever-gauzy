import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { InvoiceEstimateRoutingModule } from './invoice-estimate.routing.module';
import { InvoiceEstimateComponent } from './invoice-estimate.component';
import { InvoicesService } from '../../@core/services/invoices.service';
import { InvoicesModule } from '../../pages/invoices/invoices.module';

@NgModule({
	imports: [InvoiceEstimateRoutingModule, InvoicesModule, CommonModule, NbCardModule, TranslateModule.forChild()],
	declarations: [InvoiceEstimateComponent],
	exports: [InvoiceEstimateComponent],
	providers: [InvoicesService]
})
export class InvoiceEstimateModule {}
