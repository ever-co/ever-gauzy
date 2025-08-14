import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { UntypedFormBuilder } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { IUserSigninWorkspaceResponse } from '@gauzy/contracts';
import { ErrorHandlingService, Store } from '@gauzy/ui-core/core';
import { BaseWorkspaceAuthComponent, CountdownTimerService, WorkspaceAuthService } from '../shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-workspace-signin',
	templateUrl: './workspace-signin.component.html',
	styleUrls: ['./workspace-signin.component.scss'],
	standalone: false
})
export class WorkspaceSigninComponent extends BaseWorkspaceAuthComponent implements OnInit {
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

	ngOnInit(): void {
		// Subscribe to timer state for UI updates
		this._timerService.timerState$.pipe(untilDestroyed(this)).subscribe((state) => {
			this.countdown = state.countdown;
			this.isCodeResent = state.isResent;
		});
	}

	/**
	 * Handle component-specific logic after confirmation response.
	 * For workspace signin: always show workspace selection if user has workspaces.
	 */
	protected handleConfirmationResponse(response: IUserSigninWorkspaceResponse): void {
		const { total_workspaces } = response;

		// Always show workspace selection for signin
		if (total_workspaces > 0) {
			this.showWorkspaceSelection = true;
		}
	}
}
