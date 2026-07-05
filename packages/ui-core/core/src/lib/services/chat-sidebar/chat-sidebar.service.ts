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

/** localStorage key holding the user's docking-side preference. */
const CHAT_SIDEBAR_POSITION_KEY = 'gauzy_chat_sidebar_position';

/** localStorage key holding the user's chat width preference. */
const CHAT_SIDEBAR_WIDTH_KEY = 'gauzy_chat_sidebar_width';

/** Default / minimum / maximum chat panel width (px). */
const DEFAULT_CHAT_WIDTH = 384;
export const MIN_CHAT_WIDTH = 300;
export const MAX_CHAT_WIDTH = 860;

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
	 * Which side of the content the chat docks to:
	 * 'start' → `Menu | Chat | Canvas`, 'end' → `Menu | Canvas | Chat`.
	 * Persisted per browser.
	 */
	readonly position = signal<'start' | 'end'>('start');

	/** Chat panel width in pixels (user-resizable, persisted). */
	readonly width = signal<number>(DEFAULT_CHAT_WIDTH);

	/**
	 * Maximized: the chat fills all space except the nav menu sidebar
	 * (`Menu | Chat`); the canvas is hidden (kept alive) until restored.
	 */
	readonly maximized = signal<boolean>(false);

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
		this.position.set(this.readStoredPosition() ?? 'start');
		this.width.set(this.readStoredWidth() ?? DEFAULT_CHAT_WIDTH);
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
	 * Collapsing always leaves maximized mode.
	 */
	setExpanded(expanded: boolean): void {
		this.expanded.set(expanded);
		if (!expanded) {
			this.maximized.set(false);
		}
		try {
			localStorage.setItem(CHAT_SIDEBAR_EXPANDED_KEY, String(expanded));
		} catch {
			// Storage unavailable (private mode / SSR) — state stays in-memory only.
		}
	}

	/** Maximize the chat (`Menu | Chat`) or restore it to its normal width. */
	toggleMaximized(): void {
		this.maximized.set(!this.maximized());
		if (this.maximized()) {
			this.expanded.set(true);
		}
	}

	/**
	 * Set the chat panel width (px), clamped to sane bounds and persisted.
	 */
	setWidth(width: number): void {
		const clamped = Math.round(Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, width)));
		this.width.set(clamped);
		try {
			localStorage.setItem(CHAT_SIDEBAR_WIDTH_KEY, String(clamped));
		} catch {
			// Storage unavailable — state stays in-memory only.
		}
	}

	/** Move the chat to the other side of the content column and persist. */
	togglePosition(): void {
		this.setPosition(this.position() === 'start' ? 'end' : 'start');
	}

	/** Dock the chat to 'start' (left of the canvas) or 'end' (right). */
	setPosition(position: 'start' | 'end'): void {
		this.position.set(position);
		try {
			localStorage.setItem(CHAT_SIDEBAR_POSITION_KEY, position);
		} catch {
			// Storage unavailable — state stays in-memory only.
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

	/** Read the persisted width; null when never set, invalid, or storage unavailable. */
	private readStoredWidth(): number | null {
		try {
			const stored = Number(localStorage.getItem(CHAT_SIDEBAR_WIDTH_KEY));
			return Number.isFinite(stored) && stored >= MIN_CHAT_WIDTH && stored <= MAX_CHAT_WIDTH ? stored : null;
		} catch {
			return null;
		}
	}

	/** Read the persisted docking side; null when never set or storage unavailable. */
	private readStoredPosition(): 'start' | 'end' | null {
		try {
			const stored = localStorage.getItem(CHAT_SIDEBAR_POSITION_KEY);
			return stored === 'start' || stored === 'end' ? stored : null;
		} catch {
			return null;
		}
	}
}
