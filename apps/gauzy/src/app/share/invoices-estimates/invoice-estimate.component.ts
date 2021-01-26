import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IInvoice } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { InvoicesService } from '../../@core/services/invoices.service';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';

@Component({
	selector: 'ga-invoice-estimate',
	templateUrl: './invoice-estimate.component.html'
})
export class InvoiceEstimateComponent
	extends TranslationBaseComponent
	implements OnInit {
	private _ngDestroy$ = new Subject<void>();
	invoiceId: string;
	token: string;
	invoice: IInvoice;

	constructor(
		private route: ActivatedRoute,
		private invoicesService: InvoicesService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.route.params
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (params) => {
				this.invoiceId = params.id;
				this.token = params.token;
				await this.getInvoiceEstimate();
			});
	}

	async getInvoiceEstimate() {
		const invoice = await this.invoicesService.getWithoutAuth(
			this.invoiceId,
			this.token,
			[
				'invoiceItems',
				'invoiceItems.employee',
				'invoiceItems.employee.user',
				'invoiceItems.project',
				'invoiceItems.product',
				'invoiceItems.invoice',
				'invoiceItems.expense',
				'invoiceItems.task',
				'fromOrganization',
				'toContact'
			]
		);

		this.invoice = invoice;
	}
}
