import { Component, OnDestroy, OnInit } from '@angular/core';
import { filter, tap } from 'rxjs/operators';
import { ErrorHandlingService } from 'apps/gauzy/src/app/@core/services/error-handling.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { UpworkService } from 'apps/gauzy/src/app/@core/services/upwork.service';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
import { untilDestroyed } from '@ngneat/until-destroy';
import { IOrganization } from '@gauzy/models';

@Component({
	selector: 'ngx-transactions',
	templateUrl: './transactions.component.html',
	styleUrls: ['./transactions.component.scss']
})
export class TransactionsComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _selectedOrganizationId: string;
	file: File;

	constructor(
		private _upworkService: UpworkService,
		private _store: Store,
		readonly translateService: TranslateService,
		private toastrService: ToastrService,
		private errorHandler: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((organization: IOrganization) => {
				this._selectedOrganizationId = organization.id;
			});
	}

	ngOnDestroy(): void {}

	imageUrlChanged(event) {
		const [file] = event.target.files;
		this.file = file;
		event.target.value = null;
	}

	importCsv() {
		const formData = new FormData();
		formData.append('file', this.file);
		formData.append('organizationId', this._selectedOrganizationId);
		this._upworkService
			.uploadTransaction(formData)
			.pipe(
				untilDestroyed(this),
				tap(() => (this.file = null))
			)
			.subscribe(
				({ totalExpenses, totalIncomes }) => {
					this.toastrService.success(
						this.getTranslation(
							'INTEGRATIONS.TOTAL_UPWORK_TRANSACTIONS_SUCCEED',
							{ totalExpenses, totalIncomes }
						)
					);
				},
				(err) => {
					// added infinite duration to error toastr, error message can be too long to read in 3 sec
					this.errorHandler.handleError(err, 0);
				}
			);
	}
}
