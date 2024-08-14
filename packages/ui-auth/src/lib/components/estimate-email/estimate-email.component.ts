import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IEstimateEmail, EstimateStatusTypesEnum, ID } from '@gauzy/contracts';
import { InvoicesService, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-estimate-email',
	templateUrl: './estimate-email.component.html'
})
export class EstimateEmailComponent extends TranslationBaseComponent implements OnInit {
	public errorMessage: string;
	public isAccepted: boolean = false;
	public loading: boolean = true;

	constructor(
		private readonly route: ActivatedRoute,
		private readonly invoicesService: InvoicesService,
		public readonly translateService: TranslateService,
		private readonly toastrService: ToastrService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.route.data
			.pipe(
				filter((data) => !!data && !!data.estimate),
				tap(({ estimate }) => this.validateEstimateEmail(estimate, this.route.snapshot.queryParams)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Validate the estimate email and update the estimate status.
	 *
	 * @param estimateEmail - The estimate email to validate.
	 * @param params - The query params from the route.
	 */
	async validateEstimateEmail(estimateEmail: IEstimateEmail, params: Params) {
		try {
			if (estimateEmail instanceof HttpErrorResponse) {
				this.errorMessage = this.getTranslation('INVOICES_PAGE.ESTIMATES.ERROR');
				this.toastrService.danger(estimateEmail);
			} else {
				this.isAccepted = params.action === 'accept';
				await this.updateEstimate(
					params['id'],
					params['token'],
					this.isAccepted,
					estimateEmail.convertAcceptedEstimates
				);
			}
		} catch (error) {
			this.errorMessage = this.getTranslation('INVOICES_PAGE.ESTIMATES.ERROR');
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Update the estimate status based on the provided parameters.
	 *
	 * @param id - The estimate ID.
	 * @param token - The estimate token.
	 * @param isAccepted - Whether the estimate is accepted or rejected.
	 * @param convertAcceptedEstimates - Whether to convert accepted estimates to drafts.
	 */
	async updateEstimate(id: ID, token: string, isAccepted: boolean, convertAcceptedEstimates: boolean) {
		let status: EstimateStatusTypesEnum;
		if (isAccepted) {
			if (convertAcceptedEstimates) {
				status = EstimateStatusTypesEnum.DRAFT;
			} else {
				status = EstimateStatusTypesEnum.ACCEPTED;
			}
		} else {
			status = EstimateStatusTypesEnum.REJECTED;
		}
		await this.invoicesService.updateWithoutAuth(id, token, {
			status,
			isEstimate: convertAcceptedEstimates ? false : true
		});
	}
}
