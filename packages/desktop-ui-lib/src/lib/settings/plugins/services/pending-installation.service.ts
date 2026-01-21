import { inject, Injectable } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { take, tap } from 'rxjs';
import { PendingInstallationActions } from '../component/+state/pending-installation.action';
import { PendingInstallationQuery } from '../component/+state/pending-installation.query';
import { PendingInstallationStore } from '../component/+state/pending-installation.store';
import { PendingInstallationDialogComponent } from '../component/pending-installation-dialog/pending-installation-dialog.component';

/**
 * Service to manage pending plugin installations.
 *
 * This service provides methods to show the pending installation dialog.
 * It should be used from components within or after the PluginsModule is loaded,
 * as it depends on the PendingInstallationDialogComponent which is declared
 * in the PluginsModule.
 *
 * The PendingInstallationGuard checks for pending plugins and updates the store,
 * but does not show the dialog. Use this service to show the dialog when appropriate.
 *
 * @example
 * ```typescript
 * // In a component that's part of or loaded after PluginsModule
 * export class MyComponent implements OnInit {
 *   private pendingInstallationService = inject(PendingInstallationService);
 *
 *   ngOnInit(): void {
 *     // Check and show dialog if there are pending plugins
 *     this.pendingInstallationService.showDialogIfPending();
 *   }
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class PendingInstallationService {
	private readonly query = inject(PendingInstallationQuery);
	private readonly store = inject(PendingInstallationStore);
	private readonly dialogService = inject(NbDialogService);
	private readonly actions = inject(Actions, { optional: true });

	/**
	 * Shows the pending installation dialog if there are pending plugins
	 * and the dialog is not already open.
	 *
	 * @returns true if the dialog was opened, false otherwise
	 */
	public showDialogIfPending(): boolean {
		if (!this.query.checked) {
			console.warn(
				'[PendingInstallationService] Check has not been performed yet. Use PendingInstallationGuard first.'
			);
			return false;
		}

		if (!this.query.hasPendingPlugins) {
			return false;
		}

		if (this.query.dialogOpen) {
			return false;
		}

		this.openDialog();
		return true;
	}

	/**
	 * Shows the pending installation dialog if there are pending plugins.
	 * Subscribes to the state and shows dialog when appropriate.
	 * This is useful for reactive scenarios.
	 */
	public showDialogIfPending$(): void {
		this.query.hasPendingPlugins$
			.pipe(
				take(1),
				tap((hasPending) => {
					if (hasPending && !this.query.dialogOpen) {
						this.openDialog();
					}
				})
			)
			.subscribe();
	}

	/**
	 * Opens the pending installation dialog.
	 */
	public openDialog(): void {
		this.store.openDialog();

		// Also dispatch action if effects are available (for consistency)
		if (this.actions) {
			this.actions.dispatch(PendingInstallationActions.openDialog());
		}

		this.dialogService.open(PendingInstallationDialogComponent, {
			closeOnBackdropClick: false,
			closeOnEsc: true,
			hasBackdrop: true,
			context: {}
		});
	}

	/**
	 * Closes the pending installation dialog.
	 */
	public closeDialog(): void {
		this.store.closeDialog();

		if (this.actions) {
			this.actions.dispatch(PendingInstallationActions.closeDialog());
		}
	}

	/**
	 * Gets whether there are pending plugins.
	 */
	public get hasPendingPlugins(): boolean {
		return this.query.hasPendingPlugins;
	}

	/**
	 * Gets the count of pending plugins.
	 */
	public get pendingCount(): number {
		return this.query.pendingCount;
	}

	/**
	 * Gets whether the check has been performed.
	 */
	public get checked(): boolean {
		return this.query.checked;
	}
}
