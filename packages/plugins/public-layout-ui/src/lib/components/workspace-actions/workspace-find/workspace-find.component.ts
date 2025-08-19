import { ChangeDetectorRef, Component, ChangeDetectionStrategy } from '@angular/core';
import { UntypedFormBuilder } from '@angular/forms';
import { UntilDestroy } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { IUserSigninWorkspaceResponse } from '@gauzy/contracts';
import { ErrorHandlingService, Store, WorkspaceAuthService } from '@gauzy/ui-core/core';
import { BaseWorkspaceAuthComponent, CountdownTimerService } from '../shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-workspace-find',
	templateUrl: './workspace-find.component.html',
	styleUrls: ['./workspace-find.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkspaceFindComponent extends BaseWorkspaceAuthComponent {
	constructor(
		public readonly translateService: TranslateService,
		protected readonly _fb: UntypedFormBuilder,
		public readonly cdr: ChangeDetectorRef,
		protected readonly _errorHandlingService: ErrorHandlingService,
		protected readonly _store: Store,
		protected readonly _workspaceAuthService: WorkspaceAuthService,
		protected readonly _timerService: CountdownTimerService
	) {
		super(translateService, _fb, cdr, _errorHandlingService, _store, _workspaceAuthService, _timerService);
	}

	/**
	 * Handle component-specific logic after confirmation response.
	 * For workspace find: always show workspace selection if user has workspaces.
	 */
	protected handleConfirmationResponse(response: IUserSigninWorkspaceResponse): void {
		const { total_workspaces } = response;

		// Always show workspace selection for find
		if (total_workspaces > 0) {
			this.showWorkspaceSelection = true;
		}
	}
}
