import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { tap, catchError, finalize } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { ActivepiecesService, ToastrService } from '@gauzy/ui-core/core';
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
export class ActivepiecesConnectionsComponent extends TranslationBaseComponent implements OnInit {
	public loading = false;
	public connections: IActivepiecesConnection[] = [];
	public integrationId: string;
	public projectId: string = '';

	constructor(
		private readonly _activepiecesService: ActivepiecesService,
		private readonly _toastrService: ToastrService,
		private readonly _route: ActivatedRoute,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._loadIntegrationId();
	}

	private _loadIntegrationId() {
		this._route.parent.params
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
	}

	private _loadConnection() {
		this.loading = true;
		this._activepiecesService
			.getConnection(this.integrationId)
			.pipe(
				tap((connection) => {
					if (connection) {
						this.connections = [connection];
					}
				}),
				catchError((error) => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.ERRORS.LOAD_CONNECTION'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error loading connection:', error);
					return EMPTY;
				}),
				finalize(() => {
					this.loading = false;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	loadConnections() {
		if (!this.projectId) {
			this._toastrService.error(
				this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.ERRORS.PROJECT_ID_REQUIRED'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
			return;
		}

		const params: IActivepiecesConnectionsListParams = {
			projectId: this.projectId
		};

		this.loading = true;
		this._activepiecesService
			.listConnections(this.integrationId, params)
			.pipe(
				tap((response) => {
					this.connections = response.data;
				}),
				catchError((error) => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.ERRORS.LOAD_CONNECTIONS'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error loading connections:', error);
					return EMPTY;
				}),
				finalize(() => {
					this.loading = false;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	deleteConnection() {
		if (!confirm(this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.CONFIRM.DELETE_CONNECTION'))) {
			return;
		}

		this.loading = true;
		this._activepiecesService
			.deleteConnection(this.integrationId)
			.pipe(
				tap(() => {
					this._toastrService.success(
						this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.SUCCESS.CONNECTION_DELETED'),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
					this.connections = [];
				}),
				catchError((error) => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.ERRORS.DELETE_CONNECTION'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error deleting connection:', error);
					return EMPTY;
				}),
				finalize(() => {
					this.loading = false;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
