import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { NbButtonModule, NbListModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { IWorkspaceResponse } from '@gauzy/contracts';
import { EverIdWorkspaceResponse } from '../services/auth-zitadel-ui.service';

/**
 * The workspaces an Ever ID sign-in may enter, and the ones an organization's sign-in rules block.
 */
@Component({
	selector: 'ngx-ever-id-workspaces',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbButtonModule, NbListModule, TranslateModule],
	template: `
		@if (response?.workspaces?.length) {
			<p class="hint">{{ 'AUTH_ZITADEL.WORKSPACES.CHOOSE' | translate }}</p>
			<div class="workspaces">
				@for (workspace of response.workspaces; track workspace.user?.id) {
					<button
						nbButton
						fullWidth
						status="basic"
						type="button"
						class="workspace"
						[disabled]="busy"
						(click)="selected.emit(workspace)"
					>
						{{ workspace.user?.tenant?.name || ('AUTH_ZITADEL.WORKSPACES.NEW_WORKSPACE' | translate) }}
					</button>
				}
			</div>
		}
		@if (response?.blocked_workspaces?.length) {
			<p class="hint blocked-title">{{ 'AUTH_ZITADEL.WORKSPACES.BLOCKED' | translate }}</p>
			<ul class="blocked">
				@for (blocked of response.blocked_workspaces; track blocked.tenantId) {
					<li>
						<strong>{{ blocked.tenantName }}</strong>
						— {{ 'AUTH_ZITADEL.WORKSPACES.BLOCKED_REASON.' + reasonKey(blocked.reason) | translate }}
					</li>
				}
			</ul>
		}
	`,
	styles: [
		`
			.workspaces {
				display: flex;
				flex-direction: column;
				gap: 8px;
			}
			.hint {
				margin: 12px 0 8px;
			}
			.blocked {
				padding-left: 18px;
			}
		`
	]
})
export class EverIdWorkspacesComponent {
	@Input() response: EverIdWorkspaceResponse | null = null;
	@Input() busy = false;
	@Output() selected = new EventEmitter<IWorkspaceResponse>();

	/** Maps a block reason to a translation key suffix. */
	reasonKey(reason: string): string {
		return reason === 'sso_enforced' ? 'COMPANY_SIGN_IN' : 'FILTERED';
	}
}
