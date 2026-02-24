import { Component, OnInit, inject, ChangeDetectionStrategy, signal, WritableSignal } from '@angular/core';
import { filter, tap, finalize } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { IOrganization } from '@gauzy/contracts';
import { ErrorHandlingService, Store, ToastrService, UpworkService } from '@gauzy/ui-core/core';

@UntilDestroy()
@Component({
	selector: 'ngx-transactions',
	templateUrl: './transactions.component.html',
	styleUrls: ['./transactions.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransactionsComponent extends TranslationBaseComponent implements OnInit {
	private readonly _upworkService = inject(UpworkService);
	private readonly _store = inject(Store);
	private readonly _toastrService = inject(ToastrService);
	private readonly _errorHandler = inject(ErrorHandlingService);

	protected loading: WritableSignal<boolean> = signal(false); // controls UI state while upload in progress
	private _selectedOrganizationId: string;
	file: File | null = null;

	constructor() {
		super(inject(TranslateService));
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

	imageUrlChanged(event) {
		// files[0] may be undefined if the user cancels the dialog
		const file = event.target.files[0] ?? null;
		this.file = file;
		event.target.value = null;
	}

	importCsv() {
		// nothing to upload or no organization selected
		// guard against null or undefined
		if (this.file == null || !this._selectedOrganizationId) {
			return;
		}

		this.loading.set(true);

		const formData = new FormData();
		formData.append('file', this.file);
		formData.append('organizationId', this._selectedOrganizationId);

		this._upworkService
			.uploadTransaction(formData)
			.pipe(
				untilDestroyed(this),
				tap(() => (this.file = null)),
				finalize(() => {
					this.loading.set(false);
				})
			)
			.subscribe({
				next: ({ totalExpenses, totalIncomes }) => {
					this._toastrService.success(
						this.getTranslation('INTEGRATIONS.TOTAL_UPWORK_TRANSACTIONS_SUCCEED', {
							totalExpenses,
							totalIncomes
						})
					);
				},
				error: (err: unknown) => {
					// added infinite duration to error toastr, error message can be too long to read in 3 sec
					this._errorHandler.handleError(err as any, 0);
				}
			});
	}
}
