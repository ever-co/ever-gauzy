import { inject, NgModule, OnDestroy, provideZoneChangeDetection } from '@angular/core';
import { PLUGIN_UI_CONFIG, getPluginUiConfig, PluginUiModule, PluginUiRegistryService } from '@gauzy/plugin-ui';
import { AppModule } from './app.module';
import { AppComponent } from './app.component';

/**
 * Root-level bootstrap module for the Gauzy UI application.
 *
 * **Responsibilities:**
 *
 * - Provides `PLUGIN_UI_CONFIG` injection token (via `getPluginUiConfig()`)
 * - Registers `PluginUiModule` to bootstrap all UI plugins and
 *   invoke their lifecycle hooks (`ngOnPluginBootstrap` / `ngOnPluginDestroy`)
 * - Registers plugin section routes into PageRouteRegistryService
 * - Calls `PluginUiRegistryService.destroyAll()` on application shutdown
 * - Wraps `AppModule` (core application logic, routes, providers)
 * - Declares the bootstrap component (`AppComponent`)
 *
 * `main.ts` bootstraps this module instead of `AppModule` directly.
 */
@NgModule({
	imports: [
		PluginUiModule.init(), // Plugin lifecycle management (ngOnPluginBootstrap / ngOnPluginDestroy)
		AppModule // Core application module (declares AppComponent + all app logic)
	],
	providers: [
		{
			provide: PLUGIN_UI_CONFIG,
			useFactory: getPluginUiConfig
		},
		provideZoneChangeDetection({ eventCoalescing: true })
	],
	bootstrap: [AppComponent]
})
export class AppBootstrapModule implements OnDestroy {
	private readonly _registry = inject(PluginUiRegistryService);

	constructor() {
		const config = getPluginUiConfig();

		/** Validate the plugin UI config. */
		if (config == null || typeof config !== 'object') {
			console.error('[AppBootstrapModule] Invalid or missing plugin UI config from getPluginUiConfig().');
			return;
		}

		/** Extract the plugin UI config. */
		const plugins = Array.isArray(config.plugins) ? config.plugins : [];
		const availableLanguages = Array.isArray(config.availableLanguages) ? config.availableLanguages : [];
		const defaultLanguage = config.defaultLanguage ?? '';
		const defaultLocale = config.defaultLocale ?? '';
		const locations = [...new Set(plugins.map((p) => p?.location).filter(Boolean))];

		console.log(
			`[AppBootstrapModule] Initialized — ` +
				`${plugins.length} plugin(s) [${locations.join(', ') || 'none'}], ` +
				`${availableLanguages.length} language(s), ` +
				`default: ${defaultLanguage} / ${defaultLocale}`
		);
	}

	/** Invokes `ngOnPluginDestroy` on every registered plugin during application shutdown. */
	async ngOnDestroy(): Promise<void> {
		console.log('[AppBootstrapModule] Application shutting down. Destroying plugins...');
		await this._registry.destroyAll();
	}
}
