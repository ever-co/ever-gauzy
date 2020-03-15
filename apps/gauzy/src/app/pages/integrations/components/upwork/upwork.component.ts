import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { Store } from '../../../../@core/services/store.service';
import { takeUntil } from 'rxjs/operators';
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
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(
				() => {
					this.file = null;
					this.toastrService.primary(
						this.getTranslation(
							'INTEGRATIONS.ADDED_UPWORK_TRANSACTION'
						),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
				},
				(err) => {
					this.errorHandler.handleError(err);
				}
			);
	}

	ngOnDestroy(): void {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
