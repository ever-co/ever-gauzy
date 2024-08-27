import { NgModule } from '@angular/core';
import { NbCardModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { InvoicesService } from '@gauzy/ui-core/core';
import { SharedModule } from './../../../shared.module';
import { InvoiceViewInnerComponent } from './invoice-view-inner.component';

@NgModule({
	imports: [NbCardModule, Angular2SmartTableModule, TranslateModule.forChild(), SharedModule],
	declarations: [InvoiceViewInnerComponent],
	exports: [InvoiceViewInnerComponent],
	providers: [InvoicesService]
})
export class InvoiceViewInnerModule {}
