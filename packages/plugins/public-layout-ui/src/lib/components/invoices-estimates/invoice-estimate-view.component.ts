import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, filter, switchMap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { IInvoice } from '@gauzy/contracts';
import { ErrorHandlingService, InvoicesService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gz-public-invoice-estimate-view',
	templateUrl: './invoice-estimate-view.component.html',
	styleUrls: ['./invoice-estimate-view.component.scss']
})
export class InvoiceEstimateViewComponent extends TranslationBaseComponent implements OnInit {
	public invoice$: Observable<IInvoice>;

	constructor(
		readonly translateService: TranslateService,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _invoicesService: InvoicesService,
		private readonly _errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit() {
		// Define relations to fetch
		const relations = [
			'invoiceItems',
			'invoiceItems.employee',
			'invoiceItems.employee.user',
			'invoiceItems.project',
			'invoiceItems.product',
			'invoiceItems.expense',
			'invoiceItems.task',
			'fromOrganization',
			'toContact'
		];

		this.invoice$ = this._activatedRoute.params.pipe(
			// Ensure that id and token are present in route params
			filter(({ id, token }) => Boolean(id && token)),
			// Fetch the invoice data based on route params
			switchMap(({ id, token }) => this._invoicesService.getPublicInvoice(id, token, relations)),
			// Handle errors gracefully
			catchError((error) => {
				console.error('Error while fetching public invoice', error);
				this._errorHandlingService.handleError(error);
				return of(null); // Return null to ensure observable continues
			}),
			// Automatically unsubscribe to prevent memory leaks
			untilDestroyed(this)
		);
	}
}
