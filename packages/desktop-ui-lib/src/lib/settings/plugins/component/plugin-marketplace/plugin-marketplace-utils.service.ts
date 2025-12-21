import { Injectable } from '@angular/core';
import {
	ICDNSource,
	IGauzySource,
	INPMSource,
	IPlugin,
	PluginScope,
	PluginSourceType,
	PluginStatus,
	PluginSubscriptionType,
	PluginType
} from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
	providedIn: 'root'
})
export class PluginMarketplaceUtilsService {
	constructor(private readonly translateService: TranslateService) {}

	public getSourceTypeLabel(type: PluginSourceType): string {
		const labels: Record<PluginSourceType, string> = {
			[PluginSourceType.CDN]: this.translateService.instant('PLUGIN.FORM.SOURCE_TYPES.CDN'),
			[PluginSourceType.NPM]: this.translateService.instant('PLUGIN.FORM.SOURCE_TYPES.NPM'),
			[PluginSourceType.GAUZY]: this.translateService.instant('PLUGIN.FORM.SOURCE_TYPES.GAUZY')
		};
		return labels[type] || type;
	}

	public getStatusLabel(status: PluginStatus): string {
		return this.translateService.instant(`PLUGIN.FORM.STATUSES.${status}`);
	}

	public getTypeLabel(type: PluginType): string {
		return this.translateService.instant(`PLUGIN.FORM.TYPES.${type}`);
	}

	public getStatusBadgeStatus(status: PluginStatus): string {
		const statusMap: Record<PluginStatus, string> = {
			[PluginStatus.ACTIVE]: 'success',
			[PluginStatus.INACTIVE]: 'warning',
			[PluginStatus.DEPRECATED]: 'info',
			[PluginStatus.ARCHIVED]: 'danger'
		};
		return statusMap[status] || 'basic';
	}

	public getSubscriptionIcon(type: PluginSubscriptionType): string {
		switch (type) {
			case PluginSubscriptionType.FREE:
				return 'gift-outline';
			case PluginSubscriptionType.TRIAL:
				return 'clock-outline';
			case PluginSubscriptionType.BASIC:
				return 'person-outline';
			case PluginSubscriptionType.PREMIUM:
				return 'star-outline';
			case PluginSubscriptionType.ENTERPRISE:
				return 'briefcase-outline';
			default:
				return 'info-outline';
		}
	}

	public getPluginTypeBadgeStatus(type: PluginType): string {
		const typeMap: Record<PluginType, string> = {
			[PluginType.DESKTOP]: 'primary',
			[PluginType.WEB]: 'info',
			[PluginType.MOBILE]: 'success'
		};
		return typeMap[type] || 'basic';
	}

	public getPluginSourceTypeBadgeStatus(type: PluginSourceType): string {
		const typeMap: Record<PluginSourceType, string> = {
			[PluginSourceType.GAUZY]: 'primary',
			[PluginSourceType.CDN]: 'info',
			[PluginSourceType.NPM]: 'danger'
		};
		return typeMap[type] || 'basic';
	}

	public getAccessLevelLabel(level: PluginScope): string {
		const labels: Record<PluginScope, string> = {
			[PluginScope.USER]: this.translateService.instant('PLUGIN.ACCESS.USER_LEVEL'),
			[PluginScope.ORGANIZATION]: this.translateService.instant('PLUGIN.ACCESS.ORG_LEVEL'),
			[PluginScope.TENANT]: this.translateService.instant('PLUGIN.ACCESS.TENANT_LEVEL')
		};
		return labels[level] || level;
	}

	public getAccessLevelBadgeStatus(level: PluginScope): string {
		const statusMap: Record<PluginScope, string> = {
			[PluginScope.TENANT]: 'success',
			[PluginScope.ORGANIZATION]: 'info',
			[PluginScope.USER]: 'primary'
		};
		return statusMap[level] || 'basic';
	}

	public getSourceDetails(plugin: IPlugin): string {
		switch (plugin.source.type) {
			case PluginSourceType.CDN:
				return (plugin.source as ICDNSource).url;
			case PluginSourceType.NPM:
				const npmSource = plugin.source as INPMSource;
				return `${npmSource.scope ? npmSource.scope + '/' : ''}${npmSource.name}@${plugin.version.number}`;
			case PluginSourceType.GAUZY:
				return (
					(plugin.source as IGauzySource).url || this.translateService.instant('PLUGIN.DETAILS.UPLOADED_FILE')
				);
			default:
				return this.translateService.instant('PLUGIN.DETAILS.UNKNOWN_SOURCE');
		}
	}

	public formatDate(date: Date | string | null): string {
		if (!date) return 'N/A';
		return new Date(date).toLocaleString();
	}
}
