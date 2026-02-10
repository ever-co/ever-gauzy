import { NgModule, OnDestroy } from '@angular/core';
import { APP_UI_CONFIG, getAppUIConfig, UIPluginModule, UIPluginRegistryService } from '@gauzy/ui-core/core';
import { AppModule } from './app.module';
import { AppComponent } from './app.component';

/**
 * Root-level bootstrap module for the Gauzy UI application.
 *
 * **Responsibilities:**
 *
 * - Provides `APP_UI_CONFIG` injection token (via `getAppUIConfig()`)
 * - Registers `UIPluginModule` to bootstrap all UI plugins and
 *   invoke their lifecycle hooks (`onPluginBootstrap` / `onPluginDestroy`)
 * - Calls `UIPluginRegistryService.destroyAll()` on application shutdown
 * - Wraps `AppModule` (core application logic, routes, providers)
 * - Declares the bootstrap component (`AppComponent`)
 *
 * `main.ts` bootstraps this module instead of `AppModule` directly.
 */
@NgModule({
	imports: [
		// Plugin lifecycle management (onPluginBootstrap / onPluginDestroy)
		UIPluginModule.init(),

		// Core application module (declares AppComponent + all app logic)
		AppModule
	],
	providers: [
		{
			provide: APP_UI_CONFIG,
			useFactory: () => getAppUIConfig()
		}
	],
	bootstrap: [AppComponent]
})
export class AppBootstrapModule implements OnDestroy {
	constructor(private readonly _registry: UIPluginRegistryService) {
		const config = getAppUIConfig();
		const locations = [...new Set(config.plugins.map((p) => p.location).filter(Boolean))];

		console.log(
			`[AppBootstrapModule] Initialized — ` +
				`${config.plugins.length} plugin(s) [${locations.join(', ') || 'none'}], ` +
				`${config.availableLanguages.length} language(s), ` +
				`default: ${config.defaultLanguage} / ${config.defaultLocale}`
		);
	}

	/** Invokes `onPluginDestroy` on every registered plugin during application shutdown. */
	async ngOnDestroy(): Promise<void> {
		console.log('[AppBootstrapModule] Application shutting down. Destroying plugins...');
		await this._registry.destroyAll();
	}
}
