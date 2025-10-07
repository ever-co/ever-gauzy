import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { tap, catchError, finalize } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { ActivepiecesService, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { IActivepiecesMcpServerPublic } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-activepieces-mcp-servers',
	templateUrl: './activepieces-mcp-servers.component.html',
	styleUrls: ['./activepieces-mcp-servers.component.scss'],
	standalone: false
})
export class ActivepiecesMcpServersComponent extends TranslationBaseComponent implements OnInit {
	public loading = false;
	public mcpServers: IActivepiecesMcpServerPublic[] = [];
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
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	loadMcpServers() {
		if (!this.projectId) {
			this._toastrService.error(
				this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.ERRORS.PROJECT_ID_REQUIRED'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
			return;
		}

		this.loading = true;
		this._activepiecesService
			.listMcpServers(this.integrationId, { projectId: this.projectId })
			.pipe(
				tap((response) => {
					this.mcpServers = response.data;
				}),
				catchError((error) => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.ERRORS.LOAD_MCP_SERVERS'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error loading MCP servers:', error);
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
