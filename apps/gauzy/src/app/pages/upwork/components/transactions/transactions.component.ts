import { Component, OnInit } from '@angular/core';
import { takeUntil, tap } from 'rxjs/operators';
import { ErrorHandlingService } from 'apps/gauzy/src/app/@core/services/error-handling.service';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { UpworkService } from 'apps/gauzy/src/app/@core/services/upwork.service';

@Component({
	selector: 'ngx-transactions',
	templateUrl: './transactions.component.html',
	styleUrls: ['./transactions.component.scss']
})
export class TransactionsComponent extends TranslationBaseComponent
	implements OnInit {
	private _ngDestroy$: Subject<void> = new Subject();
	private _selectedOrganizationId: string;
	file: File;

	constructor(
		private _upworkService: UpworkService,
		private _store: Store,
		readonly translateService: TranslateService,
		private toastrService: NbToastrService,
		private errorHandler: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((org) => {
				if (org) {
					this._selectedOrganizationId = org.id;
				}
			});
	}

	imageUrlChanged(event) {
		const [file] = event.target.files;
		this.file = file;
		event.target.value = null;
	}

	importCsv() {
		const formData = new FormData();
		formData.append('file', this.file);
		formData.append('orgId', this._selectedOrganizationId);
		this._upworkService
			.uploadTransaction(formData)
			.pipe(
				takeUntil(this._ngDestroy$),
				tap(() => (this.file = null))
			)
			.subscribe(
				({ totalExpenses, totalIncomes }) => {
					this.toastrService.primary(
						this.getTranslation(
							'INTEGRATIONS.TOTAL_UPWORK_TRANSACTIONS_SUCCEED',
							{ totalExpenses, totalIncomes }
						),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
				},
				(err) => {
					// added infinite duration to error toastr, error message can be too long to read in 3 sec
					this.errorHandler.handleError(err, 0);
				}
			);
	}
}
