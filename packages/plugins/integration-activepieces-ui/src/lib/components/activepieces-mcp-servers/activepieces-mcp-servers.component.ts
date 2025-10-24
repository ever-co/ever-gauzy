import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { tap, catchError, finalize } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { ActivepiecesService, ActivepiecesStoreService, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { IActivepiecesMcpServerPublic, IActivepiecesMcpServersListParams } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-activepieces-mcp-servers',
	templateUrl: './activepieces-mcp-servers.component.html',
	styleUrls: ['./activepieces-mcp-servers.component.scss'],
	standalone: false
})
export class ActivepiecesMcpServersComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public loading = false;
	public mcpServers: IActivepiecesMcpServerPublic[] = [];
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
				}),
				untilDestroyed(this)
			)
			.subscribe();

		// Subscribe to store MCP servers
		this._activepiecesStore.mcpServers$
			.pipe(
				tap((servers: IActivepiecesMcpServerPublic[]) => {
					if (servers && servers.length > 0) {
						this.mcpServers = servers;
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Load MCP servers for a specific project
	 * GET /integration/activepieces/mcp-servers/:integrationId?projectId={projectId}
	 */
	loadMcpServers() {
		if (!this.projectId) {
			this._toastrService.error('Project ID is required');
			return;
		}

		if (!this.integrationId) {
			return;
		}

		const params: IActivepiecesMcpServersListParams = {
			projectId: this.projectId
		};

		this._activepiecesStore.setMcpLoading(true);
		this.loading = true;

		this._activepiecesService
			.listMcpServers(this.integrationId, params)
			.pipe(
				tap((response: any) => {
					this.mcpServers = response.data;
					this._activepiecesStore.setMcpServers(response.data);
				}),
				catchError((error) => {
					this._toastrService.error('Failed to load MCP servers: ' + error.message);
					this._activepiecesStore.setMcpError(error.message);
					return EMPTY;
				}),
				finalize(() => {
					this.loading = false;
					this._activepiecesStore.setMcpLoading(false);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void {}
}
