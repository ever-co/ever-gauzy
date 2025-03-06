import { ChangeDetectionStrategy, ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';

import { Subject, tap } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import {
	ICDNSource,
	IGauzySource,
	INPMSource,
	IPlugin,
	PluginSourceType,
	PluginStatus,
	PluginType
} from '@gauzy/contracts';

import { distinctUntilChange } from '@gauzy/ui-core/common';
import { Store, ToastrNotificationService } from '../../../../../services';
import { PluginElectronService } from '../../../services/plugin-electron.service';
import { PluginService } from '../../../services/plugin.service';
import { PluginMarketplaceUploadComponent } from '../plugin-marketplace-upload/plugin-marketplace-upload.component';

@Component({
	selector: 'gauzy-plugin-marketplace-item',
	templateUrl: './plugin-marketplace-item.component.html',
	styleUrls: ['./plugin-marketplace-item.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginMarketplaceItemComponent implements OnInit, OnDestroy {
	private readonly destroy$ = new Subject<void>();

	plugin: IPlugin | null = null;
	pluginId = '';
	loading = true;

	selectedVersion = '';
	installed = false;
	needUpdate = false;
	installing = false;
	uninstalling = false;

	// Enum for template use
	readonly pluginStatus = PluginStatus;
	readonly pluginType = PluginType;
	readonly pluginSourceType = PluginSourceType;

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private pluginService: PluginService,
		private pluginElectronService: PluginElectronService,
		private dialogService: NbDialogService,
		private store: Store,
		public translateService: TranslateService,
		private toastrService: ToastrNotificationService,
		private ngZone: NgZone,
		private cdr: ChangeDetectorRef
	) {}

	ngOnInit(): void {
		this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
			this.pluginId = params['id'];
			this.loadPlugin();
		});
		this.pluginElectronService.status
			.pipe(
				distinctUntilChange(),
				tap(({ status, message }) =>
					this.ngZone.run(() => {
						this.handleStatus({ status, message });
					})
				),
				takeUntil(this.destroy$)
			)
			.subscribe();
	}

	private handleStatus(notification: { status: string; message?: string }) {
		switch (notification.status) {
			case 'success':
				this.installing = false;
				this.uninstalling = this.installing;
				this.toastrService.success(notification.message);
				break;
			case 'error':
				this.installing = false;
				this.uninstalling = this.installing;
				this.toastrService.error(notification.message);
				break;
			case 'inProgress':
				this.installing = !this.uninstalling;
				this.toastrService.info(notification.message);
				break;
			default:
				this.installing = false;
				this.uninstalling = this.installing;
				this.toastrService.warn('Unexpected Status');
				break;
		}
		this.cdr.markForCheck();
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	async loadPlugin(): Promise<void> {
		this.loading = true;

		try {
			// TODO: Replace with actual API call when ready
			// const { tenantId, organizationId } = this.store.selectedOrganization;
			// this.plugin = await this.pluginService.getById(this.pluginId, { tenantId, organizationId });

			// Current hardcoded plugin for demonstration
			this.plugin = this.getMockPlugin();

			// Select the latest version
			this.selectedVersion = this.plugin.versions[this.plugin.versions.length - 1];

			await this.checkInstallation();
		} catch (error) {
			this.handleError(error);
		} finally {
			this.loading = false;
			this.cdr.markForCheck();
		}
	}

	private handleError(error: any): void {
		this.toastrService.error(error);
		this.router.navigate(['/settings/marketplace-plugins']);
	}

	async checkInstallation(): Promise<void> {
		if (!this.plugin) return;

		try {
			const plugin = await this.pluginElectronService.plugin(this.plugin.name);
			this.installed = !!plugin;

			if (this.installed && this.plugin.versions) {
				const latestVersion = this.plugin.versions[this.plugin.versions.length - 1];
				this.needUpdate = plugin.version !== latestVersion;
			}
		} catch (error) {
			console.error('Installation check failed', error);
		}
	}

	// Utility methods with strong typing
	getSourceTypeLabel(type: PluginSourceType): string {
		const labels: Record<PluginSourceType, string> = {
			[PluginSourceType.CDN]: this.translateService.instant('PLUGIN.FORM.SOURCE_TYPES.CDN'),
			[PluginSourceType.NPM]: this.translateService.instant('PLUGIN.FORM.SOURCE_TYPES.NPM'),
			[PluginSourceType.GAUZY]: this.translateService.instant('PLUGIN.FORM.SOURCE_TYPES.GAUZY')
		};
		return labels[type] || type;
	}

	getStatusLabel(status: PluginStatus): string {
		return this.translateService.instant(`PLUGIN.FORM.STATUSES.${status}`);
	}

	getTypeLabel(type: PluginType): string {
		return this.translateService.instant(`PLUGIN.FORM.TYPES.${type}`);
	}

	getStatusBadgeStatus(status: PluginStatus): string {
		const statusMap: Record<PluginStatus, string> = {
			[PluginStatus.ACTIVE]: 'success',
			[PluginStatus.INACTIVE]: 'warning',
			[PluginStatus.DEPRECATED]: 'info',
			[PluginStatus.ARCHIVED]: 'danger'
		};
		return statusMap[status] || 'basic';
	}

	getPluginTypeBadgeStatus(type: PluginType): string {
		const typeMap: Record<PluginType, string> = {
			[PluginType.DESKTOP]: 'primary',
			[PluginType.WEB]: 'info',
			[PluginType.MOBILE]: 'success'
		};
		return typeMap[type] || 'basic';
	}

	getSourceDetails(plugin: IPlugin): string {
		switch (plugin.source.type) {
			case PluginSourceType.CDN:
				return (plugin.source as ICDNSource).url;
			case PluginSourceType.NPM:
				const npmSource = plugin.source as INPMSource;
				return `${npmSource.scope ? npmSource.scope + '/' : ''}${npmSource.name}@${npmSource.version}`;
			case PluginSourceType.GAUZY:
				return (
					(plugin.source as IGauzySource).url || this.translateService.instant('PLUGIN.DETAILS.UPLOADED_FILE')
				);
			default:
				return this.translateService.instant('PLUGIN.DETAILS.UNKNOWN_SOURCE');
		}
	}

	async updatePluginStatus(status: PluginStatus): Promise<void> {
		if (!this.plugin || !this.isOwner) return;

		try {
			// TODO: Implement actual update logic
			this.plugin.status = status;
			this.toastrService.success(this.translateService.instant('PLUGIN.MESSAGES.STATUS_UPDATED'));
		} catch (error) {
			this.toastrService.error(this.translateService.instant('COMMON.UPDATE_FAILED'));
		}
	}

	navigateToEdit(): void {
		if (!this.plugin) return;

		this.dialogService.open(PluginMarketplaceUploadComponent, {
			backdropClass: 'backdrop-blur',
			context: { plugin: this.plugin }
		});
	}

	navigateBack(): void {
		this.router.navigate(['/settings/marketplace-plugins']);
	}

	formatDate(date: Date | string | null): string {
		if (!date) return 'N/A';
		return new Date(date).toLocaleString();
	}

	get isOwner(): boolean {
		const user = this.store.user;
		return user?.employee?.id === this.plugin?.uploadedBy?.id ?? false;
	}

	async onVersionChange(): Promise<void> {
		await this.checkInstallation();
	}

	// Placeholder methods - TODO: Implement actual logic
	updatePlugin(): void {
		this.installPlugin(true);
	}

	public async uninstallPlugin(): Promise<void> {
		this.uninstalling = true;
		this.pluginElectronService.uninstall(this.plugin as any);
		await this.loadPlugin();
	}

	installPlugin(isUpdate = false): void {
		this.installing = true;
		switch (this.plugin.source.type) {
			case PluginSourceType.GAUZY:
			case PluginSourceType.CDN:
				this.pluginElectronService.downloadAndInstall({ url: this.plugin.source.url, contextType: 'cdn' });
				break;
			case PluginSourceType.NPM:
				this.pluginElectronService.downloadAndInstall({
					...{
						pkg: {
							name: this.plugin.source.name,
							version: isUpdate
								? this.plugin.versions[this.plugin.versions.length - 1]
								: this.selectedVersion
						},
						registry: {
							privateURL: this.plugin.source.registry,
							authToken: this.plugin.source.authToken
						}
					},
					contextType: 'npm'
				});
			default:
				this.installing = false;
				break;
		}
	}

	// Mock data method for demonstration
	private getMockPlugin(): IPlugin {
		return {
			id: '3',
			tenantId: 'tenant-555',
			organizationId: 'org-222',
			name: 'Continues Recording',
			description: 'An AI-powered chatbot for customer support.',
			type: PluginType.DESKTOP,
			status: PluginStatus.ACTIVE,
			versions: ['0.1.12', '0.9.0', '1.0.0'],
			source: {
				id: 'source-3',
				tenantId: 'tenant-555',
				organizationId: 'org-222',
				type: PluginSourceType.GAUZY,
				url: 'https://gauzy.example.com/plugins/ai-chatbot'
			} as IGauzySource,
			checksum: 'sha256-ghj123',
			signature: 'signature-111',
			author: 'Charlie Brown',
			license: 'Apache-2.0',
			homepage: 'https://example.com/ai-chatbot',
			repository: 'https://github.com/example/ai-chatbot',
			uploadedBy: {
				id: 'emp-003',
				firstName: 'Eve',
				lastName: 'Davis',
				email: 'eve@example.com'
			} as any,
			uploadedAt: new Date('2022-07-10'),
			downloadCount: 5200,
			lastDownloadedAt: new Date('2024-01-20')
		};
	}
}
