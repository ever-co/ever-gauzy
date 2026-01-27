import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { tap } from 'rxjs';
import { PendingInstallationActions } from '../+state/pending-installation.action';
import { PendingInstallationQuery } from '../+state/pending-installation.query';
import { IPendingPluginInstallation } from '../+state/pending-installation.store';

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
	standalone: false
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
		this.query.pendingPlugins$
			.pipe(
				tap((plugins) => this.pendingPlugins.set(plugins)),
				untilDestroyed(this)
			)
			.subscribe();

		this.query.loading$
			.pipe(
				tap((loading) => this.loading.set(loading)),
				untilDestroyed(this)
			)
			.subscribe();

		this.query.isAnyInstalling$
			.pipe(
				tap((installing) => this.isAnyInstalling.set(installing)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Install a single plugin
	 */
	protected installPlugin(plugin: IPendingPluginInstallation): void {
		if (!plugin.plugin.version?.id) {
			console.error('Plugin version ID is missing');
			return;
		}

		this.actions.dispatch(PendingInstallationActions.installPlugin(plugin.plugin.id, plugin.plugin.version.id));
	}

	/**
	 * Install all pending plugins
	 */
	protected installAll(): void {
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
	protected getPluginLogo(plugin: IPendingPluginInstallation): string {
		// IPlugin doesn't have a logo property, return default
		return 'assets/images/plugins/default-plugin-icon.png';
	}

	/**
	 * Get plugin initials for avatar fallback
	 */
	protected getPluginInitials(plugin: IPendingPluginInstallation): string {
		const name = plugin.plugin.name || 'Plugin';
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
	 * Get count of plugins currently being installed
	 */
	protected getInstallingCount(): number {
		return this.pendingPlugins().filter((p) => p.isInstalling || p.isInstalled).length;
	}

	/**
	 * Get progress percentage for batch installation
	 */
	protected getProgressPercentage(): number {
		const total = this.pendingPlugins().length;
		if (total === 0) return 0;
		const completed = this.pendingPlugins().filter((p) => p.isInstalled).length;
		const installing = this.pendingPlugins().filter((p) => p.isInstalling).length;
		return Math.round(((completed + installing * 0.5) / total) * 100);
	}
}
