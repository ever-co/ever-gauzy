import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { tap, catchError, finalize } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { ActivepiecesService, ActivepiecesStoreService, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { IActivepiecesConnection, IActivepiecesConnectionsListParams, IActivepiecesConnectionsListResponse } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-activepieces-connections',
	templateUrl: './activepieces-connections.component.html',
	styleUrls: ['./activepieces-connections.component.scss'],
	standalone: false
})
export class ActivepiecesConnectionsComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public loading = false;
	public connections: IActivepiecesConnection[] = [];
	public integrationId!: string;
	public projectId: string = '';

	constructor(
		private readonly _activepiecesService: ActivepiecesService,
		private readonly _activepiecesStore: ActivepiecesStoreService,
		private readonly _toastrService: ToastrService,
		private readonly _activatedRoute: ActivatedRoute,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		const route = this._activatedRoute.parent ?? this._activatedRoute;
		route.params
			.pipe(
				tap((params) => {
					this.integrationId = params['id'];
					if (this.integrationId) {
						this._loadConnection();
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();

		// Subscribe to store connections
		this._activepiecesStore.connections$
			.pipe(
				tap((connections: IActivepiecesConnection[] | null | undefined) => {
					this.connections = connections ?? [];
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	trackByConnectionId(_: number, connection: IActivepiecesConnection): string {
		return connection.id;
	}

	/**
	 * Load connection for the integration
	 * GET /integration/activepieces/connection/:integrationId
	 */
	private _loadConnection() {
		if (!this.integrationId) {
			return;
		}

		this._activepiecesStore.setLoading(true);
		this.loading = true;

		this._activepiecesService
			.getConnection(this.integrationId)
			.pipe(
				tap((connection: IActivepiecesConnection) => {
					if (connection) {
						this.connections = [connection];
						this._activepiecesStore.setCurrentConnection(connection);
						this._activepiecesStore.setConnections([connection]);
					} else {
						this.connections = [];
						this._activepiecesStore.setConnections([]);
					}
				}),
				catchError((error) => {
					const errorMessage = this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.ERRORS.LOAD_CONNECTION', { error: error.message });
					this._toastrService.error(errorMessage);
					this._activepiecesStore.setError(errorMessage);
					return EMPTY;
				}),
				finalize(() => {
					this.loading = false;
					this._activepiecesStore.setLoading(false);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Load connections list for a specific project
	 * GET /integration/activepieces/connections/:integrationId?projectId={projectId}
	 */
	loadConnections() {
		if (!this.projectId) {
			this._toastrService.error(this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.ERRORS.PROJECT_ID_REQUIRED'));
			return;
		}

		if (!this.integrationId) {
			return;
		}

		const params: IActivepiecesConnectionsListParams = {
			projectId: this.projectId
		};

		this._activepiecesStore.setLoading(true);
		this.loading = true;

		this._activepiecesService
			.listConnections(this.integrationId, params)
			.pipe(
				tap((response: IActivepiecesConnectionsListResponse) => {
					this.connections = response.data;
					this._activepiecesStore.setConnections(response.data);
				}),
				catchError((error) => {
					const errorMessage = this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.ERRORS.LOAD_CONNECTIONS', { error: error.message });
					this._toastrService.error(errorMessage);
					this._activepiecesStore.setError(errorMessage);
					return EMPTY;
				}),
				finalize(() => {
					this.loading = false;
					this._activepiecesStore.setLoading(false);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Delete connection
	 * DELETE /integration/activepieces/connection/:integrationId
	 */
	deleteConnection() {
		if (!window.confirm(this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.CONNECTIONS.DELETE_CONFIRM'))) {
			return;
		}

		if (!this.integrationId) {
			return;
		}

		this._activepiecesStore.setLoading(true);
		this.loading = true;

		this._activepiecesService
		.deleteConnection(this.integrationId)
			.pipe(
				tap(() => {
					this._toastrService.success(this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.SUCCESS.CONNECTION_DELETED'));
					// Reload connections from ActivePieces to reflect the actual current state
					if (this.projectId) {
						this.loadConnections();
					} else {
						this._loadConnection();
					}
				}),
				catchError((error) => {
					const errorMessage = this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.ERRORS.DELETE_CONNECTION', { error: error.message });
					this._toastrService.error(errorMessage);
					this._activepiecesStore.setError(errorMessage);
					return EMPTY;
				}),
				finalize(() => {
					this.loading = false;
					this._activepiecesStore.setLoading(false);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void {}
}
