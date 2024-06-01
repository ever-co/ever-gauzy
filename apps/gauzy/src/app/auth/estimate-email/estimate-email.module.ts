import { NgModule } from '@angular/core';
import { EstimateEmailComponent } from './estimate-email.component';
import { InvoicesService } from '../../@core/services/invoices.service';
import { CommonModule } from '@angular/common';
import { EstimateEmailService } from '../../@core/services/estimate-email.service';
import { NbCardModule, NbSpinnerModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';

@NgModule({
	imports: [CommonModule, NbCardModule, NbSpinnerModule, TranslateModule.forChild()],
	providers: [InvoicesService, EstimateEmailService],
	declarations: [EstimateEmailComponent]
})
export class EstimateEmailModule {}
