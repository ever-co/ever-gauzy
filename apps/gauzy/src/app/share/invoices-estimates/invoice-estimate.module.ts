import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { InvoicesService } from '@gauzy/ui-core/core';
import { InvoiceEstimateRoutingModule } from './invoice-estimate.routing.module';
import { InvoiceEstimateComponent } from './invoice-estimate.component';
import { InvoicesModule } from '../../pages/invoices/invoices.module';

@NgModule({
	imports: [InvoiceEstimateRoutingModule, InvoicesModule, CommonModule, NbCardModule, I18nTranslateModule.forChild()],
	declarations: [InvoiceEstimateComponent],
	exports: [InvoiceEstimateComponent],
	providers: [InvoicesService]
})
export class InvoiceEstimateModule {}
