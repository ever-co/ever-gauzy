import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { InvoicesService } from '../../@core/services/invoices.service';
import { IEstimateEmail, EstimateStatusTypesEnum } from '@gauzy/models';
import { EstimateEmailService } from '../../@core/services/estimate-email.service';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';

@Component({
	templateUrl: './estimate-email.component.html'
})
export class EstimateEmailComponent
	extends TranslationBaseComponent
	implements OnInit {
	constructor(
		private route: ActivatedRoute,
		private invoicesService: InvoicesService,
		private estimateEmailService: EstimateEmailService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	token: string;
	isAccepted: boolean;
	estimateEmail: IEstimateEmail;
	errorMessage: string;
	loading = true;

	ngOnInit() {
		this.route.queryParams.subscribe(async (params) => {
			if (params['action'] === 'accept') {
				this.isAccepted = true;
			} else if (params['action'] === 'reject') {
				this.isAccepted = false;
			}

			try {
				const estimateEmail = await this.loadEstimateEmail(
					params['email'],
					params['token']
				);
				this.errorMessage = '';
				if (estimateEmail) {
					await this.updateEstimate(params['id'], this.isAccepted);
				}
			} catch (error) {
				this.errorMessage = this.getTranslation(
					'INVOICES_PAGE.ESTIMATES.ERROR'
				);
			}
			this.loading = false;
		});
	}

	async updateEstimate(id: string, isAccepted: boolean) {
		await this.invoicesService.updateWithoutAuth(id, {
			status: isAccepted
				? EstimateStatusTypesEnum.ACCEPTED
				: EstimateStatusTypesEnum.REJECTED
		});
	}

	loadEstimateEmail = async (email: string, token: string) => {
		const estimateEmail = await this.estimateEmailService.validate([], {
			email,
			token
		});
		return estimateEmail;
	};
}
