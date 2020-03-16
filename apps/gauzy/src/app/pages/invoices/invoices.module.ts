import { NgModule } from '@angular/core';
import { InvoicesRoutingModule } from './invoices-routing.module';
import { InvoicesComponent } from './invoices.component';
import { InvoicesService } from '../../@core/services/invoices.service';
import {
	NbSpinnerModule,
	NbCardModule,
	NbIconModule,
	NbButtonModule
} from '@nebular/theme';
import { InvoicesMutationModule } from './invoices-mutation/invoices-mutation.module';
import { NgSelectModule } from '@ng-select/ng-select';

@NgModule({
	imports: [
		InvoicesRoutingModule,
		NgSelectModule,
		NbSpinnerModule,
		NbCardModule,
		NbIconModule,
		NbButtonModule,
		InvoicesMutationModule
	],
	declarations: [InvoicesComponent],
	providers: [InvoicesService]
})
export class InvoicesModule {}
