import { Component } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { InvoicesMutationComponent } from './invoices-mutation/invoices-mutation.component';

@Component({
	templateUrl: './invoices.component.html'
})
export class InvoicesComponent {
	constructor(private dialogService: NbDialogService) {}

	async add() {
		this.dialogService.open(InvoicesMutationComponent, {
			context: {}
		});
	}
}
