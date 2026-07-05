import { Injectable, signal, Type } from '@angular/core';

/**
 * Configuration for a chat sidebar panel.
 */
export interface IChatSidebarConfig {
	/** Factory that returns the component to render inside the sidebar. */
	loadComponent: () => Promise<Type<any>> | Type<any>;
	/** Optional CSS class applied to the nb-sidebar element. */
	class?: string;
	/** Whether the sidebar starts expanded when no user preference is stored yet. */
	defaultExpanded?: boolean;
}

/** localStorage key holding the user's expand/collapse preference. */
const CHAT_SIDEBAR_EXPANDED_KEY = 'gauzy_chat_sidebar_expanded';

/**
 * ChatSidebarService
 *
 * Manages the dedicated chat sidebar slot in the layout.
 * Decoupled from `NavigationBuilderService` which handles
 * the right-side dynamic sidebars (changelog, settings, etc.).
 *
 * Plugins register a chat sidebar component via `register()`.
 * The layout template reads `config()` to conditionally render
 * the sidebar between the menu sidebar and main content, and
 * `expanded()` to drive its collapse/expand state. The state is
 * persisted per browser so the user's preference survives reloads.
 */
@Injectable({ providedIn: 'root' })
export class ChatSidebarService {
	/** The registered chat sidebar config (null if not registered). */
	readonly config = signal<IChatSidebarConfig | null>(null);

	/** Whether the chat sidebar is currently expanded. */
	readonly expanded = signal<boolean>(false);

	/**
	 * Whether the chat is available for the current user — set by the
	 * registering plugin once it has checked the user's permission and
	 * the backend configuration (`GET /api/ai-chat/config`). The layout
	 * and header render the chat sidebar/toggle only when this is true.
	 */
	readonly available = signal<boolean>(false);

	/** Update chat availability (permission + backend configuration). */
	setAvailable(available: boolean): void {
		this.available.set(available);
	}

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
		this.expanded.set(this.readStoredExpanded() ?? sidebarConfig.defaultExpanded ?? false);
	}

	/**
	 * Unregister the chat sidebar (e.g. on plugin teardown).
	 */
	unregister(): void {
		this.config.set(null);
		this.expanded.set(false);
	}

	/** Toggle the sidebar between expanded and collapsed. */
	toggle(): void {
		this.setExpanded(!this.expanded());
	}

	/** Expand the sidebar. */
	expand(): void {
		this.setExpanded(true);
	}

	/** Collapse the sidebar. */
	collapse(): void {
		this.setExpanded(false);
	}

	/**
	 * Set the expand state and persist the user's preference.
	 */
	setExpanded(expanded: boolean): void {
		this.expanded.set(expanded);
		try {
			localStorage.setItem(CHAT_SIDEBAR_EXPANDED_KEY, String(expanded));
		} catch {
			// Storage unavailable (private mode / SSR) — state stays in-memory only.
		}
	}

	/** Read the persisted preference; null when never set or storage unavailable. */
	private readStoredExpanded(): boolean | null {
		try {
			const stored = localStorage.getItem(CHAT_SIDEBAR_EXPANDED_KEY);
			return stored === null ? null : stored === 'true';
		} catch {
			return null;
		}
	}
}
