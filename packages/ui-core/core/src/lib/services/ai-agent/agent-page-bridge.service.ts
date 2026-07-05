import { Injectable, inject } from '@angular/core';
import { Router, Route } from '@angular/router';
import { NgxPermissionsService } from 'ngx-permissions';

/**
 * Metadata describing a navigable page for the AI agent.
 */
export interface IAgentPageInfo {
	/** Absolute route path (e.g. '/pages/tasks/dashboard'). */
	path: string;
	/** Human-readable page title. */
	title: string;
	/** Short description of what the page does / which forms it hosts. */
	description?: string;
	/** Permissions (PermissionsEnum values) required to see the page, if any. */
	permissions?: string[];
}

/** Result of an agent-triggered navigation. */
export interface IAgentNavigationResult {
	success: boolean;
	/** The URL after navigation settled. */
	url: string;
	error?: string;
}

/**
 * AgentPageBridgeService
 *
 * Lets the embedded AI agent discover and open the platform's pages
 * (rendered in the main content column — the "canvas" next to the chat).
 *
 * Pages are described by a registry seeded by the AI chat plugin
 * (see `registerPages`) and augmented with routes discovered from the
 * Angular router config. Navigation is restricted to in-app routes.
 */
@Injectable({ providedIn: 'root' })
export class AgentPageBridgeService {
	private readonly router = inject(Router);
	private readonly permissionsService = inject(NgxPermissionsService);

	private readonly registry = new Map<string, IAgentPageInfo>();

	/**
	 * Register pages the agent may open. Later registrations
	 * with the same path override earlier ones.
	 */
	registerPages(pages: IAgentPageInfo[]): void {
		for (const page of pages) {
			this.registry.set(this.normalize(page.path), page);
		}
	}

	/**
	 * List pages the current user is allowed to open
	 * (registry entries filtered by required permissions).
	 */
	async listPages(): Promise<IAgentPageInfo[]> {
		const pages = [...this.registry.values()];
		const results = await Promise.all(
			pages.map(async (page) => {
				if (!page.permissions?.length) return page;
				const allowed = await this.permissionsService.hasPermission(page.permissions);
				return allowed ? page : null;
			})
		);
		return results.filter((page): page is IAgentPageInfo => page !== null);
	}

	/**
	 * Navigate the main content area to an in-app route.
	 * Only absolute in-app paths are allowed (no external URLs).
	 */
	async openPage(path: string, queryParams?: Record<string, string>): Promise<IAgentNavigationResult> {
		const normalized = this.normalize(path);
		if (!normalized.startsWith('/')) {
			return { success: false, url: this.router.url, error: `Only absolute in-app paths are allowed, got '${path}'.` };
		}
		try {
			const success = await this.router.navigate([normalized], { queryParams });
			return {
				success,
				url: this.router.url,
				...(success ? {} : { error: 'Navigation was rejected (route guard or unknown route).' })
			};
		} catch (error: any) {
			return { success: false, url: this.router.url, error: error?.message ?? String(error) };
		}
	}

	/** The current route URL and document title. */
	describeCurrentPage(): { url: string; title: string } {
		return { url: this.router.url, title: typeof document !== 'undefined' ? document.title : '' };
	}

	/**
	 * Best-effort discovery of concrete (non-parameterised) routes
	 * currently loaded in the router config. Lazy routes appear only
	 * after they have been loaded, hence the curated registry remains
	 * the primary source.
	 */
	discoverLoadedRoutes(): string[] {
		const found: string[] = [];
		const walk = (routes: Route[], prefix: string) => {
			for (const route of routes ?? []) {
				const segment = route.path ?? '';
				if (segment.includes('*') || segment.includes(':')) continue;
				const full = [prefix, segment].filter(Boolean).join('/');
				if (route.component || route.loadComponent) {
					found.push('/' + full);
				}
				if (route.children) walk(route.children, full);
			}
		};
		walk(this.router.config, '');
		return found;
	}

	private normalize(path: string): string {
		try {
			// Strip origin if a full URL to this app was passed.
			const url = new URL(path, 'http://local');
			return url.pathname + (url.search ?? '');
		} catch {
			return path;
		}
	}
}
