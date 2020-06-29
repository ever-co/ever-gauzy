import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { InvoicesService } from '../../@core/services/invoices.service';
import { EstimateEmail } from '@gauzy/models';
import { EstimateEmailService } from '../../@core/services/estimate-email.service';

@Component({
	templateUrl: './estimate-email.component.html'
})
export class EstimateEmailComponent implements OnInit {
	constructor(
		private route: ActivatedRoute,
		private invoicesService: InvoicesService,
		private estimateEmailService: EstimateEmailService
	) {}

	token: string;
	isAccepted: boolean;
	estimateEmail: EstimateEmail;
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
				this.errorMessage = 'An error occured.';
			}
			this.loading = false;
		});
	}

	async updateEstimate(id: string, isAccepted: boolean) {
		await this.invoicesService.updateWithoutAuth(id, {
			isAccepted: isAccepted
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
