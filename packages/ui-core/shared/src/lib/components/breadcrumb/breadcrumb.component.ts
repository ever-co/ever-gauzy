import { Component, Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { merge, of } from 'rxjs';
import { catchError, filter, map, startWith } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { NavMenuBuilderService, NavMenuSectionItem } from '@gauzy/ui-core/core';

/**
 * One rendered level of the breadcrumb trail.
 */
export interface IBreadcrumb {
	/** Translated, human readable label. */
	label: string;
	/** Absolute router link, or `null` when this level has no navigable route. */
	link: string | null;
	/** Optional icon rendered instead of the label (the "home" crumb). */
	icon?: string;
}

/**
 * A navigation menu item paired with the sections it lives under.
 */
interface IMenuMatch {
	item: NavMenuSectionItem;
	ancestors: NavMenuSectionItem[];
	/** The item's link, normalized to a bare path. */
	link: string;
}

/**
 * Breadcrumb trail for the current route.
 *
 * Labels are resolved from the navigation menu tree instead of the raw URL, so every
 * crumb shows the same translated wording as the sidebar. Mounted once by
 * `ngx-header-title`, which gives every page carrying a page title a trail without
 * touching page templates. When the URL has no navigation menu entry the trail falls
 * back to the URL segments, so a page never renders an empty nav.
 */
@Component({
	selector: 'ngx-breadcrumbs',
	templateUrl: './breadcrumb.component.html',
	styleUrls: ['./breadcrumb.component.scss'],
	standalone: false
})
export class BreadcrumbComponent {
	/** Application home — `/pages` redirects here. */
	private static readonly HOME_LINK = '/pages/dashboard';

	/** Segments that are record identifiers (uuid / numeric): they carry no readable meaning. */
	private static readonly ID_SEGMENT = /^\d+$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

	/**
	 * Menu sections skipped while matching. "Favorites" mirrors links that already live
	 * elsewhere in the tree, so a page marked as favorite would otherwise win the match and render
	 * as "Favorites / …" instead of its real place in the hierarchy.
	 */
	private static readonly IGNORED_SECTION_IDS = new Set<string>(['favorites']);

	/** Namespaces probed (in order) when a URL segment has no navigation menu entry. */
	private static readonly SEGMENT_TRANSLATION_NAMESPACES = ['MENU', 'BUTTONS'];

	private readonly _router = inject(Router);
	private readonly _navMenuBuilderService = inject(NavMenuBuilderService);
	private readonly _translateService = inject(TranslateService);

	/** Current URL, tracked across navigations. */
	private readonly _url = toSignal(
		this._router.events.pipe(
			filter((event): event is NavigationEnd => event instanceof NavigationEnd),
			map((event: NavigationEnd) => event.urlAfterRedirects),
			startWith(this._router.url)
		),
		{ initialValue: this._router.url }
	);

	/**
	 * Navigation menu tree — the source of translated, hierarchy-aware labels.
	 *
	 * A broken menu must not take the page title down with it: the trail degrades to
	 * its URL-derived fallback instead (the sidebar treats menu errors the same way).
	 */
	private readonly _menu = toSignal(
		this._navMenuBuilderService.menuConfig$.pipe(
			catchError((error: unknown) => {
				console.error('[Breadcrumbs] Could not read the navigation menu:', error);
				return of([] as NavMenuSectionItem[]);
			})
		),
		{ initialValue: [] as NavMenuSectionItem[] }
	);

	/**
	 * Emits whenever the resolved translations change so the trail can be re-translated
	 * in place.
	 *
	 * `onLangChange` alone is not enough: the trail is built during the first paint,
	 * which regularly happens BEFORE the i18n bundle has finished loading. Every label
	 * then falls back to the menu item's hard-coded English `title` and, with no further
	 * language change, stays English for the rest of the session. `onTranslationChange`
	 * (bundle loaded / extended) and `onDefaultLangChange` close that window.
	 */
	private readonly _language = toSignal(
		merge(
			this._translateService.onLangChange,
			this._translateService.onTranslationChange,
			this._translateService.onDefaultLangChange
		).pipe(startWith(null)),
		{ initialValue: null }
	);

	/** The trail for the current route, outermost level first. */
	public readonly breadcrumbs: Signal<IBreadcrumb[]> = computed(() => {
		// Read the language signal so switching language rebuilds (and re-translates) the trail.
		this._language();
		return this.buildTrail(this._url(), this._menu());
	});

	/**
	 * Builds the breadcrumb trail for a URL.
	 *
	 * @param url Current router URL — may carry a query string, fragment or matrix params.
	 * @param sections Navigation menu sections as defined by the menu builder.
	 * @returns The ordered trail; empty outside the `/pages` shell.
	 */
	private buildTrail(url: string, sections: NavMenuSectionItem[]): IBreadcrumb[] {
		const path = this.toPath(url);

		// Breadcrumbs describe the in-app page hierarchy only (auth / public routes have none).
		if (!path.startsWith('/pages')) {
			return [];
		}

		const match = this.findDeepestMatch(path, sections);
		const trail = this.finalize(
			match
				? [
						this.homeCrumb(),
						...match.ancestors.map((ancestor: NavMenuSectionItem) => this.toCrumb(ancestor)),
						this.toCrumb(match.item),
						...this.segmentCrumbs(path, match.link)
					]
				: [this.homeCrumb(), ...this.segmentCrumbs(path, '/pages')]
		);

		// Fallback. The menu is not a complete map of the router: sections come and go
		// with permissions, features and plugins, and it is empty altogether on the very
		// first paint. Whenever the resolved trail says nothing about where we are —
		// no match, or a match that collapsed into the home crumb — describe the URL
		// instead of rendering a lone home icon.
		if (trail.length <= 1 && !this.isHomePath(path)) {
			return this.finalize([this.homeCrumb(), ...this.segmentCrumbs(path, '/pages')]);
		}

		return trail;
	}

	/**
	 * Checks whether a path is the application home itself.
	 *
	 * @param path Normalized URL path.
	 * @returns True for `/pages` and for the route the home crumb points at.
	 */
	private isHomePath(path: string): boolean {
		return path === '/pages' || path === BreadcrumbComponent.HOME_LINK;
	}

	/**
	 * Finds the deepest navigation menu item whose link is an ancestor of (or equal to) the path.
	 *
	 * @param path Normalized URL path.
	 * @param sections Navigation menu sections to search.
	 * @returns The matched item together with its ancestor sections, or `null` when nothing matches.
	 */
	private findDeepestMatch(path: string, sections: NavMenuSectionItem[]): IMenuMatch | null {
		const matches = this.collectMatches(path, sections, []);

		return matches.reduce((best: IMenuMatch | null, candidate: IMenuMatch) => {
			// Deepest link wins — it is the most specific description of the page.
			if (!best) {
				return candidate;
			}
			return this.matchScore(candidate) > this.matchScore(best) ? candidate : best;
		}, null);
	}

	/**
	 * Walks the menu tree and collects every item whose link covers the path.
	 *
	 * @param path Normalized URL path.
	 * @param items Menu items at the current level.
	 * @param ancestors Sections walked through to reach `items`.
	 * @returns All matching items, in tree order.
	 */
	private collectMatches(path: string, items: NavMenuSectionItem[], ancestors: NavMenuSectionItem[]): IMenuMatch[] {
		const matches: IMenuMatch[] = [];

		for (const item of items ?? []) {
			if (BreadcrumbComponent.IGNORED_SECTION_IDS.has(item.id)) {
				continue;
			}

			const link = typeof item.link === 'string' ? this.toPath(item.link) : null;

			// Hidden items are decoys, not destinations: "Focus" and "Applications" are
			// permanently hidden yet both point at /pages/dashboard, so matching them
			// labelled the dashboard "Focus". Their children can still be real pages,
			// so only the item's own link is skipped — the subtree is still walked.
			if (link && !item.hidden && this.isAncestorPath(link, path)) {
				matches.push({ item, ancestors: [...ancestors], link });
			}

			if (item.items?.length) {
				matches.push(...this.collectMatches(path, item.items, [...ancestors, item]));
			}
		}

		return matches;
	}

	/**
	 * Ranks a match by how much of the path its link accounts for.
	 *
	 * @param match Candidate match.
	 * @returns The comparable score — the number of segments the link covers.
	 */
	private matchScore(match: IMenuMatch): number {
		return match.link.split('/').length;
	}

	/**
	 * Builds crumbs for the URL segments left over after the matched menu link.
	 *
	 * These levels are deliberately not links: nothing guarantees an intermediate URL
	 * resolves to a route (`/pages/employees/edit` on its own is a 404), and a dead
	 * crumb is worse than a plain one.
	 *
	 * @param path Normalized URL path.
	 * @param basePath The already-covered prefix of the path.
	 * @returns Crumbs for the remaining, meaningful segments.
	 */
	private segmentCrumbs(path: string, basePath: string): IBreadcrumb[] {
		return path
			.slice(basePath.length)
			.split('/')
			.filter((segment: string) => !!segment && !BreadcrumbComponent.ID_SEGMENT.test(segment))
			.map((segment: string) => ({ label: this.labelForSegment(segment), link: null }));
	}

	/**
	 * Removes empty and repeated levels and marks the last crumb as the current page.
	 *
	 * @param crumbs Raw trail.
	 * @returns The trail ready for rendering.
	 */
	private finalize(crumbs: IBreadcrumb[]): IBreadcrumb[] {
		const trail: IBreadcrumb[] = [];

		for (const crumb of crumbs) {
			if (!crumb.label && !crumb.icon) {
				continue;
			}

			// Collapse repeats — two menu levels pointing at the same route, say.
			// The home crumb is exempt: it renders as an icon, so it never *reads* as a
			// repeat, and collapsing it is what left /pages/dashboard (where home and
			// the "Dashboards" menu item share a link) with a single wordless crumb.
			const previous = trail.at(-1);
			const eitherIsIcon = !!previous?.icon || !!crumb.icon;
			const duplicate =
				previous &&
				!eitherIsIcon &&
				((!!crumb.link && previous.link === crumb.link) || previous.label === crumb.label);
			if (duplicate) {
				continue;
			}

			trail.push({ ...crumb });
		}

		// The current page is never a link — it is announced with aria-current instead.
		const current = trail.at(-1);
		if (current) {
			current.link = null;
		}

		// A lone home crumb reads better as a word than as a bare icon.
		if (trail.length === 1) {
			trail[0] = { ...trail[0], icon: undefined };
		}

		return trail;
	}

	/**
	 * Maps a navigation menu item to a crumb.
	 *
	 * @param item Navigation menu item.
	 * @returns The crumb, linked only when the menu item itself defines a route.
	 */
	private toCrumb(item: NavMenuSectionItem): IBreadcrumb {
		const key = item.data?.translationKey;
		const link = typeof item.link === 'string' ? this.toPath(item.link) : null;

		if (!key) {
			return { label: item.title ?? '', link };
		}

		// `noTranslate` items hold user content (custom dashboard names) — render literally so a
		// name that happens to match an i18n key is not translated away.
		if (item.data?.noTranslate) {
			return { label: key, link };
		}

		return { label: this.translateOrNull(key) ?? item.title ?? '', link };
	}

	/**
	 * The root crumb, pointing at the application home.
	 *
	 * @returns The home crumb.
	 */
	private homeCrumb(): IBreadcrumb {
		return {
			label: this.translateOrNull('MENU.DASHBOARDS') ?? 'Dashboards',
			link: BreadcrumbComponent.HOME_LINK,
			icon: 'home-outline'
		};
	}

	/**
	 * Resolves a readable label for a URL segment that has no navigation menu entry.
	 *
	 * @param segment Raw URL segment (e.g. `edit`, `expense-recurring`).
	 * @returns A translated label when a matching i18n key exists, a humanized segment otherwise.
	 */
	private labelForSegment(segment: string): string {
		const key = segment.replace(/[^a-z\d]+/gi, '_').toUpperCase();

		for (const namespace of BreadcrumbComponent.SEGMENT_TRANSLATION_NAMESPACES) {
			const translated = this.translateOrNull(`${namespace}.${key}`);
			if (translated) {
				return translated;
			}
		}

		return this.humanize(segment);
	}

	/**
	 * Translates a key, treating "missing" as absent.
	 *
	 * @param key i18n key.
	 * @returns The translation, or `null` when the key is unknown (ngx-translate echoes the key back)
	 *          or resolves to a namespace object rather than a string.
	 */
	private translateOrNull(key: string): string | null {
		const translated = this._translateService.instant(key);
		return typeof translated === 'string' && translated !== key && translated.trim().length > 0 ? translated : null;
	}

	/**
	 * Turns a URL segment into title case words.
	 *
	 * @param segment Raw URL segment.
	 * @returns The humanized text (`expense-recurring` → `Expense Recurring`).
	 */
	private humanize(segment: string): string {
		return segment
			.replace(/[-_]+/g, ' ')
			.replace(/([a-z\d])([A-Z])/g, '$1 $2')
			.replace(/\b\w/g, (char: string) => char.toUpperCase())
			.trim();
	}

	/**
	 * Strips the query string, fragment, matrix params and any trailing slash from a URL.
	 *
	 * @param url Router URL or menu link.
	 * @returns The bare path.
	 */
	private toPath(url: string): string {
		const [withoutQuery = ''] = String(url ?? '').split(/[?#]/);
		// Matrix params attach to a SINGLE segment (`/pages/settings;tab=1/ai`), so they have to
		// be stripped segment by segment. Splitting the whole URL on the first `;` instead would
		// discard every later segment and leave the trail pointing at the wrong page.
		const path = withoutQuery
			.split('/')
			.map((segment: string) => segment.split(';')[0])
			.join('/');

		return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
	}

	/**
	 * Checks whether a link addresses the path itself or one of its ancestors, comparing
	 * whole segments so `/pages/tag` never matches `/pages/tags`.
	 *
	 * @param link Candidate ancestor path.
	 * @param path Current path.
	 * @returns True when `link` is `path` or a segment-aligned prefix of it.
	 */
	private isAncestorPath(link: string, path: string): boolean {
		return path === link || path.startsWith(`${link}/`);
	}
}
