import { NgModule } from '@angular/core';
import { EstimateEmailComponent } from './estimate-email.component';
import { InvoicesService } from '../../@core/services/invoices.service';
import { CommonModule } from '@angular/common';
import { EstimateEmailService } from '../../@core/services/estimate-email.service';
import { NbCardModule, NbSpinnerModule } from '@nebular/theme';
import { TranslaterModule } from '../../@shared/translater/translater.module';

@NgModule({
	imports: [CommonModule, NbCardModule, NbSpinnerModule, TranslaterModule],
	providers: [InvoicesService, EstimateEmailService],
	entryComponents: [EstimateEmailComponent],
	declarations: [EstimateEmailComponent]
})
export class EstimateEmailModule {}
