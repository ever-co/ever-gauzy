import { Component, OnInit, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { tap, catchError, finalize } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { NbButtonModule, NbCardModule, NbIconModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { IMakeComConnection, IMakeComSetupStatus } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { MakeComStoreService, ToastrService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-make-com-connections',
	templateUrl: './make-com-connections.component.html',
	styleUrls: ['./make-com-connections.component.scss'],
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		CommonModule,
		TranslateModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbSpinnerModule,
		NbTooltipModule
	]
})
export class MakeComConnectionsComponent extends TranslationBaseComponent implements OnInit {
	private readonly _makeComStoreService = inject(MakeComStoreService);
	private readonly _toastrService = inject(ToastrService);

	public connections = signal<IMakeComConnection[]>([]);
	public loading = signal(false);
	public actionLoading = signal<Record<number, boolean>>({});
	public setupStatus = signal<IMakeComSetupStatus | null>(null);

	constructor() {
		super();
	}

	ngOnInit() {
		this._checkSetupAndLoad();
	}

	private _checkSetupAndLoad() {
		this.loading.set(true);
		this._makeComStoreService
			.loadSetupStatus()
			.pipe(
				tap((status) => {
					this.setupStatus.set(status);
					if (status.isComplete) {
						this._loadConnections();
					} else {
						this.connections.set([]);
						this.loading.set(false);
					}
				}),
				catchError(() => {
					this.setupStatus.set({ hasAccessToken: false, zone: null, makeOrganizationId: null, makeTeamId: null, isComplete: false });
					this.connections.set([]);
					this.loading.set(false);
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _loadConnections() {
		this.loading.set(true);
		this._makeComStoreService
			.loadConnections()
			.pipe(
				tap((connections) => this.connections.set(connections)),
				catchError((error) => {
					this.connections.set([]);
					this._toastrService.error(
						error?.error?.message || 'Failed to load connections',
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					return EMPTY;
				}),
				finalize(() => this.loading.set(false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	testConnection(connection: IMakeComConnection) {
		this.actionLoading.update((prev) => ({ ...prev, [connection.id]: true }));
		this._makeComStoreService
			.testConnection(connection.id)
			.pipe(
				tap(() => {
					this._toastrService.success(
						`Connection "${connection.name}" is valid`,
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
				}),
				catchError((error) => {
					this._toastrService.error(
						error?.error?.message || 'Connection test failed',
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					return EMPTY;
				}),
				finalize(() => this.actionLoading.update((prev) => ({ ...prev, [connection.id]: false }))),
				untilDestroyed(this)
			)
			.subscribe();
	}

	refresh() {
		this._checkSetupAndLoad();
	}
}
