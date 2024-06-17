import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IEstimateEmail, EstimateStatusTypesEnum } from '@gauzy/contracts';
import { InvoicesService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { ToastrService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './estimate-email.component.html'
})
export class EstimateEmailComponent extends TranslationBaseComponent implements OnInit {
	constructor(
		private readonly route: ActivatedRoute,
		private readonly invoicesService: InvoicesService,
		public readonly translateService: TranslateService,
		private readonly toastrService: ToastrService
	) {
		super(translateService);
	}

	errorMessage: string;
	isAccepted: boolean = false;
	loading: boolean = true;

	ngOnInit() {
		this.route.data
			.pipe(
				filter((data) => !!data && !!data.estimate),
				tap(({ estimate }) => this.validateEstimateEmail(estimate, this.route.snapshot.queryParams)),
				untilDestroyed(this)
			)
			.subscribe();
	}

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

	async updateEstimate(id: string, token: string, isAccepted: boolean, convertAcceptedEstimates: boolean) {
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
