import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { tap, catchError, finalize } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { ActivepiecesService, ActivepiecesStoreService, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { IActivepiecesConnection, IActivepiecesConnectionsListParams } from '@gauzy/contracts';
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
	public integrationId: string;
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
		this._activatedRoute.parent.params
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
				tap((connections: IActivepiecesConnection[]) => {
					if (connections && connections.length > 0) {
						this.connections = connections;
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
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
					}
				}),
				catchError((error) => {
					this._toastrService.error('Failed to load connection: ' + error.message);
					this._activepiecesStore.setError(error.message);
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
			this._toastrService.error('Project ID is required');
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
				tap((response: any) => {
					this.connections = response.data;
					this._activepiecesStore.setConnections(response.data);
				}),
				catchError((error) => {
					this._toastrService.error('Failed to load connections: ' + error.message);
					this._activepiecesStore.setError(error.message);
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
		if (!confirm('Are you sure you want to delete this connection?')) {
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
					this._toastrService.success('Connection deleted successfully');
					this.connections = [];
					this._activepiecesStore.clearConnections();
				}),
				catchError((error) => {
					this._toastrService.error('Failed to delete connection: ' + error.message);
					this._activepiecesStore.setError(error.message);
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
