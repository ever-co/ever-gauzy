import { NgModule, OnDestroy } from '@angular/core';
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
 * - Calls `PluginUiRegistryService.destroyAll()` on application shutdown
 * - Wraps `AppModule` (core application logic, routes, providers)
 * - Declares the bootstrap component (`AppComponent`)
 *
 * `main.ts` bootstraps this module instead of `AppModule` directly.
 */
@NgModule({
	imports: [
		PluginUiModule.init(), // Plugin lifecycle management (ngOnPluginBootstrap / ngOnPluginDestroy
		AppModule // Core application module (declares AppComponent + all app logic)
	],
	providers: [
		{
			provide: PLUGIN_UI_CONFIG,
			useFactory: () => getPluginUiConfig()
		}
	],
	bootstrap: [AppComponent]
})
export class AppBootstrapModule implements OnDestroy {
	constructor(private readonly _registry: PluginUiRegistryService) {
		const config = getPluginUiConfig();
		const locations = [...new Set(config.plugins.map((p) => p.location).filter(Boolean))];

		console.log(
			`[AppBootstrapModule] Initialized — ` +
				`${config.plugins.length} plugin(s) [${locations.join(', ') || 'none'}], ` +
				`${config.availableLanguages.length} language(s), ` +
				`default: ${config.defaultLanguage} / ${config.defaultLocale}`
		);
	}

	/** Invokes `ngOnPluginDestroy` on every registered plugin during application shutdown. */
	async ngOnDestroy(): Promise<void> {
		console.log('[AppBootstrapModule] Application shutting down. Destroying plugins...');
		await this._registry.destroyAll();
	}
}
