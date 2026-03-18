import { Injectable, Optional } from '@angular/core';
import { IPlugin, PluginType } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { ToastrNotificationService } from '../../../services/toastr-notification.service';
import { PluginElectronService } from './plugin-electron.service';

@Injectable({ providedIn: 'root' })
export class PluginEnvironmentService {
	constructor(
		private readonly translateService: TranslateService,
		private readonly toastrService: ToastrNotificationService,
		@Optional()
		private readonly pluginElectronService?: PluginElectronService
	) {}

	/** Determine if running inside the Electron desktop shell */
	public isDesktop(): boolean {
		return !!this.pluginElectronService?.isDesktop;
	}

	/** Basic mobile detection using the user agent */
	public isMobile(): boolean {
		if (typeof navigator === 'undefined') {
			return false;
		}
		return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
	}

	/** Web is any non-desktop, non-mobile environment in the browser */
	public isWeb(): boolean {
		return !this.isDesktop() && !this.isMobile();
	}

	/** Whether the current environment supports installing the given plugin type */
	public canInstallPlugin(plugin: IPlugin): boolean {
		if (!plugin?.type) {
			return false;
		}

		// First check if it's a desktop plugin and we're in the desktop environment, which also allows deep-link installation from web
		if(this.canUseDeepLink(plugin)) {
			return true;
		}

		switch (plugin.type) {
			case PluginType.DESKTOP:
				return this.isDesktop();
			case PluginType.MOBILE:
				return this.isMobile();
			case PluginType.WEB:
				return this.isWeb();
			default:
				return true;
		}
	}

	public canUseDeepLink(plugin: IPlugin): boolean {
		return this.isWeb() && plugin?.type === PluginType.DESKTOP;
	}

	/** Translation key describing the environment mismatch for the plugin type */
	private getEnvironmentMismatchMessage(plugin: IPlugin): string {
		if (!plugin?.type) {
			return 'PLUGIN.ERRORS.CANNOT_INSTALL';
		}

		switch (plugin.type) {
			case PluginType.DESKTOP:
				return 'PLUGIN.ERRORS.DESKTOP_PLUGIN_REQUIRES_DESKTOP_ENVIRONMENT';
			case PluginType.WEB:
				return 'PLUGIN.ERRORS.WEB_PLUGIN_REQUIRES_WEB_ENVIRONMENT';
			case PluginType.MOBILE:
				return 'PLUGIN.ERRORS.MOBILE_PLUGIN_REQUIRES_MOBILE_ENVIRONMENT';
			default:
				return 'PLUGIN.ERRORS.UNSUPPORTED_PLUGIN_TYPE';
		}
	}

	public getEnvironmentMismatchWarning(plugin: IPlugin): string {
		return this.translateService.instant(this.getEnvironmentMismatchMessage(plugin));
	}

	public notifyEnvironmentMismatch(plugin: IPlugin): void {
		this.toastrService.warn(this.getEnvironmentMismatchWarning(plugin));
	}
}
