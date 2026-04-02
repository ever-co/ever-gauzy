import { Component, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { tap, catchError, finalize } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { IMakeComConnection, IMakeComSetupStatus } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { MakeComStoreService, ToastrService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-make-com-connections',
	templateUrl: './make-com-connections.component.html',
	styleUrls: ['./make-com-connections.component.scss'],
	standalone: false
})
export class MakeComConnectionsComponent extends TranslationBaseComponent implements OnInit {
	public connections: IMakeComConnection[] = [];
	public loading = false;
	public actionLoading: Record<number, boolean> = {};
	public setupStatus: IMakeComSetupStatus | null = null;

	constructor(
		private readonly _makeComStoreService: MakeComStoreService,
		private readonly _toastrService: ToastrService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._checkSetupAndLoad();
	}

	private _checkSetupAndLoad() {
		this.loading = true;
		this._makeComStoreService
			.loadSetupStatus()
			.pipe(
				tap((status) => {
					this.setupStatus = status;
					if (status.isComplete) {
						this._loadConnections();
					} else {
						this.loading = false;
					}
				}),
				catchError(() => {
					this.setupStatus = { hasAccessToken: false, zone: null, makeOrganizationId: null, makeTeamId: null, isComplete: false };
					this.loading = false;
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _loadConnections() {
		this.loading = true;
		this._makeComStoreService
			.loadConnections()
			.pipe(
				tap((connections) => (this.connections = connections)),
				catchError((error) => {
					this._toastrService.error(
						error?.error?.message || 'Failed to load connections',
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					return EMPTY;
				}),
				finalize(() => (this.loading = false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	testConnection(connection: IMakeComConnection) {
		this.actionLoading[connection.id] = true;
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
				finalize(() => (this.actionLoading[connection.id] = false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	refresh() {
		this._checkSetupAndLoad();
	}
}
