import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogRef,
	NbIconModule,
	NbListModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslatePipe } from '@ngx-translate/core';
import { combineLatest, debounceTime, distinctUntilChanged, tap } from 'rxjs';
import { PendingInstallationActions } from '../+state/pending-installation.action';
import { PendingInstallationQuery } from '../+state/pending-installation.query';
import { IPendingPluginInstallation } from '../+state/pending-installation.store';
import { DesktopDirectiveModule } from '../../../../directives/desktop-directive.module';

/**
 * Dialog component that displays pending plugin installations
 * Shows a list of subscribed plugins that are not yet installed locally
 * with options to install individually or all at once
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-pending-installation-dialog',
	templateUrl: './pending-installation-dialog.component.html',
	styleUrls: ['./pending-installation-dialog.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		NbCardModule,
		NbIconModule,
		NbButtonModule,
		NbTooltipModule,
		NbListModule,
		NbSpinnerModule,
		DesktopDirectiveModule,
		TranslatePipe
	]
})
export class PendingInstallationDialogComponent implements OnInit, OnDestroy {
	private readonly dialogRef = inject(NbDialogRef<PendingInstallationDialogComponent>);
	private readonly actions = inject(Actions);
	private readonly query = inject(PendingInstallationQuery);

	/** Pending plugins to display */
	protected readonly pendingPlugins = signal<IPendingPluginInstallation[]>([]);

	/** Loading state */
	protected readonly loading = signal<boolean>(false);

	/** Whether any plugin is currently installing */
	protected readonly isAnyInstalling = signal<boolean>(false);

	/** Installation queue active */
	protected readonly queueActive = signal<boolean>(false);

	ngOnInit(): void {
		this.observeState();
	}

	ngOnDestroy(): void {
		// Cleanup handled by UntilDestroy
	}

	/**
	 * Subscribe to state changes from the query
	 */
	private observeState(): void {
		// Combine all state observables for efficiency
		combineLatest([this.query.pendingPlugins$, this.query.loading$, this.query.isAnyInstalling$])
			.pipe(
				debounceTime(10), // Small debounce to batch updates
				distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
				tap(([plugins, loading, installing]) => {
					this.pendingPlugins.set(plugins);
					this.loading.set(loading);
					this.isAnyInstalling.set(installing);

					// Update queue status
					const hasInstalling = plugins.some((p) => p.isInstalling);
					this.queueActive.set(hasInstalling);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Install a single plugin
	 */
	protected installPlugin(pending: IPendingPluginInstallation): void {
		if (!pending.plugin.version?.id) {
			console.error('Plugin version ID is missing');
			return;
		}

		if (pending.isInstalling || pending.isInstalled) {
			return;
		}

		this.actions.dispatch(PendingInstallationActions.installPlugin(pending.plugin.id, pending.plugin.version.id));
	}

	/**
	 * Install all pending plugins
	 */
	protected installAll(): void {
		const installablePlugins = this.pendingPlugins().filter((p) => !p.isInstalling && !p.isInstalled && !p.error);

		if (installablePlugins.length === 0) {
			return;
		}

		this.actions.dispatch(PendingInstallationActions.installAllPlugins());
	}

	/**
	 * Skip a single plugin
	 */
	protected skipPlugin(pluginId: string): void {
		this.actions.dispatch(PendingInstallationActions.skipPlugin(pluginId));
	}

	/**
	 * Skip all and close dialog
	 */
	protected skipAll(): void {
		this.actions.dispatch(PendingInstallationActions.skipAll());
		this.dialogRef.close(false);
	}

	/**
	 * Close the dialog
	 */
	protected close(): void {
		this.actions.dispatch(PendingInstallationActions.closeDialog());
		this.dialogRef.close(true);
	}

	/**
	 * Get plugin logo URL or fallback
	 */
	protected getPluginLogo(_: IPendingPluginInstallation): string {
		return 'assets/images/plugins/default-plugin-icon.png';
	}

	/**
	 * Get plugin initials for avatar fallback
	 */
	protected getPluginInitials(pending: IPendingPluginInstallation): string {
		const name = pending.plugin.name || 'Plugin';
		const words = name.split(/\s+/);
		if (words.length >= 2) {
			return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
		}
		return name.substring(0, 2).toUpperCase();
	}

	/**
	 * Track by function for ngFor optimization
	 */
	protected trackByPluginId(index: number, item: IPendingPluginInstallation): string {
		return item.plugin.id;
	}

	/**
	 * Get count of plugins currently being installed or completed
	 */
	protected getInstallingCount(): number {
		return this.pendingPlugins().filter((p) => p.isInstalling || p.isInstalled).length;
	}

	/**
	 * Get count of successfully installed plugins
	 */
	protected getInstalledCount(): number {
		return this.pendingPlugins().filter((p) => p.isInstalled).length;
	}

	/**
	 * Get count of failed installations
	 */
	protected getFailedCount(): number {
		return this.pendingPlugins().filter((p) => p.error && !p.isInstalling).length;
	}

	/**
	 * Get progress percentage for batch installation
	 */
	protected getProgressPercentage(): number {
		const total = this.pendingPlugins().length;
		if (total === 0) return 0;

		const completed = this.getInstalledCount();
		const installing = this.pendingPlugins().filter((p) => p.isInstalling).length;

		// Count completed plugins as 100%, installing as 50%
		return Math.round(((completed + installing * 0.5) / total) * 100);
	}

	/**
	 * Check if all installations are complete (success or failure)
	 */
	protected allInstallationsComplete(): boolean {
		const plugins = this.pendingPlugins();
		if (plugins.length === 0) return true;

		return plugins.every((p) => p.isInstalled || (p.error && !p.isInstalling));
	}

	/**
	 * Check if there are any retryable errors
	 */
	protected hasRetryableErrors(): boolean {
		return this.getFailedCount() > 0;
	}

	/**
	 * Retry all failed installations
	 */
	protected retryFailed(): void {
		const failedPlugins = this.pendingPlugins().filter((p) => p.error && !p.isInstalling);

		failedPlugins.forEach((pending) => {
			if (pending.plugin.version?.id) {
				this.installPlugin(pending);
			}
		});
	}

	/**
	 * Load more functionality
	 */
	loadMore(): void {
		this.actions.dispatch(PendingInstallationActions.loadMore());
	}
}
