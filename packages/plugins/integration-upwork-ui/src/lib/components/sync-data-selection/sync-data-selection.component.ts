import { Component, inject, ChangeDetectionStrategy, signal, WritableSignal, Input } from '@angular/core';
import { of, Observable } from 'rxjs';
import { NbDialogRef } from '@nebular/theme';
import { tap, catchError } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ISelectedEmployee, IEngagement } from '@gauzy/contracts';
import { ErrorHandlingService, ToastrService, UpworkStoreService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@UntilDestroy()
@Component({
	selector: 'ngx-sync-data-selection',
	templateUrl: './sync-data-selection.component.html',
	styleUrls: ['./sync-data-selection.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SyncDataSelectionComponent extends TranslationBaseComponent {
	private readonly _us = inject(UpworkStoreService);
	private readonly toastrService = inject(ToastrService);
	protected readonly dialogRef = inject(NbDialogRef<SyncDataSelectionComponent>);
	private readonly errorHandlingService = inject(ErrorHandlingService);

	contractsSettings$: Observable<any> = this._us.contractsSettings$;
	private readonly contractsSignal: WritableSignal<IEngagement[]> = signal<IEngagement[]>([]);

	/** exposes the current contracts value and allows context injection */
	@Input()
	set contracts(value: IEngagement[] | null | undefined) {
		// always update the signal so we don't keep stale data
		// an empty array or null means nothing selected
		this.contractsSignal.set(value ?? []);
	}
	get contracts(): IEngagement[] {
		return this.contractsSignal();
	}

	constructor() {
		super(inject(TranslateService));
	}

	syncData() {
		this._us
			.syncDataWithContractRelated(this.contracts)
			.pipe(
				tap(() => {
					this.toastrService.success(this.getTranslation('INTEGRATIONS.UPWORK_PAGE.CONTRACTS_RELATED_DATA'));
					this.dialogRef.close();
				}),
				catchError((err) => {
					this.errorHandlingService.handleError(err);
					return of(null);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	setSelectedEmployee(employee: ISelectedEmployee | null | undefined) {
		if (employee) {
			this._us.setSelectedEmployeeId(employee.id);
		}
	}
}
