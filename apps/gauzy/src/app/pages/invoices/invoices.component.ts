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
		// const addData = await dialog.onClose.pipe(first()).toPromise();
		// this.selectedTag = null;
		// this.disableButton = true;
		// console.warn(addData);
		// if (addData) {
		// 	this.toastrService.primary(
		// 		this.getTranslation('TAGS_PAGE.TAGS_ADD_TAG'),
		// 		this.getTranslation('TOASTR.TITLE.SUCCESS')
		// 	);
		// }
		// this.loadSettings();
	}
}
