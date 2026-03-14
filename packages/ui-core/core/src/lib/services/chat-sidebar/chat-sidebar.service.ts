import { Injectable, signal, Type } from '@angular/core';

/**
 * Configuration for a chat sidebar panel.
 */
export interface IChatSidebarConfig {
	/** Factory that returns the component to render inside the sidebar. */
	loadComponent: () => Promise<Type<any>> | Type<any>;
	/** Optional CSS class applied to the nb-sidebar element. */
	class?: string;
}

/**
 * ChatSidebarService
 *
 * Manages the dedicated chat sidebar slot in the layout.
 * Decoupled from `NavigationBuilderService` which handles
 * the right-side dynamic sidebars (changelog, settings, etc.).
 *
 * Plugins register a chat sidebar component via `register()`.
 * The layout template reads `config()` to conditionally render
 * the sidebar between the menu sidebar and main content.
 */
@Injectable({ providedIn: 'root' })
export class ChatSidebarService {
	/** The registered chat sidebar config (null if not registered). */
	readonly config = signal<IChatSidebarConfig | null>(null);

	/**
	 * Register a component to render in the chat sidebar slot.
	 *
	 * @param sidebarConfig - Configuration for the chat sidebar.
	 * @throws Error if a chat sidebar is already registered.
	 */
	register(sidebarConfig: IChatSidebarConfig): void {
		if (this.config()) {
			throw new Error('A chat sidebar is already registered. Only one chat sidebar is supported.');
		}
		this.config.set(sidebarConfig);
	}

	/**
	 * Unregister the chat sidebar (e.g. on plugin teardown).
	 */
	unregister(): void {
		this.config.set(null);
	}
}
