import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IInvoice } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { InvoicesService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-invoice-estimate',
	templateUrl: './invoice-estimate.component.html',
	styleUrls: ['./invoice-estimate.component.scss']
})
export class InvoiceEstimateComponent extends TranslationBaseComponent implements OnInit {
	invoiceId: string;
	token: string;
	invoice: IInvoice;

	constructor(
		private readonly route: ActivatedRoute,
		private readonly invoicesService: InvoicesService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.route.params.pipe(untilDestroyed(this)).subscribe(async (params) => {
			this.invoiceId = params.id;
			this.token = params.token;
			await this.getInvoiceEstimate();
		});
	}

	async getInvoiceEstimate() {
		try {
			this.invoice = await this.invoicesService.getPublicInvoice(this.invoiceId, this.token, [
				'invoiceItems',
				'invoiceItems.employee',
				'invoiceItems.employee.user',
				'invoiceItems.project',
				'invoiceItems.product',
				'invoiceItems.expense',
				'invoiceItems.task',
				'fromOrganization',
				'toContact'
			]);
		} catch (error) {
			console.error('Error while getting public invoice', error);
		}
	}
}
