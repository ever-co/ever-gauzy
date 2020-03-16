import { InvoicesMutationComponent } from './invoices-mutation.component';
import { InvoicesService } from '../../../@core/services/invoices.service';
import { NgModule } from '@angular/core';
import {
	NbIconModule,
	NbCardModule,
	NbInputModule,
	NbButtonModule,
	NbDatepickerModule,
	NbSelectModule,
	NbCheckboxModule
} from '@nebular/theme';
import { ReactiveFormsModule } from '@angular/forms';
import { ColorPickerModule } from 'ngx-color-picker';
import { CommonModule } from '@angular/common';

@NgModule({
	imports: [
		NbIconModule,
		NbCardModule,
		NbInputModule,
		NbButtonModule,
		ReactiveFormsModule,
		ColorPickerModule,
		NbDatepickerModule,
		CommonModule,
		NbSelectModule,
		NbCheckboxModule
	],
	declarations: [InvoicesMutationComponent],
	entryComponents: [InvoicesMutationComponent],
	providers: [InvoicesService]
})
export class InvoicesMutationModule {}
