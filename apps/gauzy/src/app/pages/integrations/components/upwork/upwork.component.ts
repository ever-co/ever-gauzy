import { Component, OnInit, OnDestroy } from '@angular/core';
import { Store } from '../../../../@core/services/store.service';
import { takeUntil, tap } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { IntegrationsService } from '../../../../@core/services/integrations.service';
import { TranslationBaseComponent } from '../../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { NbToastrService } from '@nebular/theme';
import { ErrorHandlingService } from '../../../../@core/services/error-handling.service';

@Component({
	selector: 'ngx-upwork',
	templateUrl: './upwork.component.html',
	styleUrls: ['./upwork.component.scss']
})
export class UpworkComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$: Subject<void> = new Subject();
	private _selectedOrganizationId: string;
	file: File;

	constructor(
		private _integrationsService: IntegrationsService,
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
		this._integrationsService
			.uploadUpworkTransaction(formData)
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

	ngOnDestroy(): void {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
