import { Component, Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
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
 * crumb shows the same translated wording as the sidebar. Mounted once in the shared
 * header, which gives every page under `/pages` a trail without touching page templates.
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
	 * elsewhere in the tree, so a favorited page would otherwise win the match and render
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

	/** Navigation menu tree — the source of translated, hierarchy-aware labels. */
	private readonly _menu = toSignal(this._navMenuBuilderService.menuConfig$, {
		initialValue: [] as NavMenuSectionItem[]
	});

	/** Emits on language change so the trail can be re-translated in place. */
	private readonly _language = toSignal(this._translateService.onLangChange.pipe(startWith(null)), {
		initialValue: null
	});

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
		const crumbs: IBreadcrumb[] = [this.homeCrumb()];

		if (match) {
			for (const ancestor of match.ancestors) {
				crumbs.push(this.toCrumb(ancestor));
			}
			crumbs.push(this.toCrumb(match.item));
			crumbs.push(...this.segmentCrumbs(path, match.link));
		} else {
			crumbs.push(...this.segmentCrumbs(path, '/pages'));
		}

		return this.finalize(crumbs);
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
			// Deepest link wins; on a tie a visible item beats a hidden twin
			// (several hidden items point at /pages/dashboard, for instance).
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

			if (link && this.isAncestorPath(link, path)) {
				matches.push({ item, ancestors: [...ancestors], link });
			}

			if (item.items?.length) {
				matches.push(...this.collectMatches(path, item.items, [...ancestors, item]));
			}
		}

		return matches;
	}

	/**
	 * Ranks a match: deeper links score higher, and visible items outrank hidden ones.
	 *
	 * @param match Candidate match.
	 * @returns The comparable score.
	 */
	private matchScore(match: IMenuMatch): number {
		return match.link.split('/').length * 2 + (match.item.hidden ? 0 : 1);
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

			// Collapse repeats — home and the "Dashboards" menu item point at the same route.
			const previous = trail[trail.length - 1];
			const duplicate =
				previous && ((!!crumb.link && previous.link === crumb.link) || previous.label === crumb.label);
			if (duplicate) {
				continue;
			}

			trail.push({ ...crumb });
		}

		if (trail.length > 0) {
			// The current page is never a link — it is announced with aria-current instead.
			trail[trail.length - 1].link = null;
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
		// `noTranslate` items hold user content (custom dashboard names) — render literally so a
		// name that happens to match an i18n key is not translated away.
		const label = key
			? item.data?.noTranslate
				? key
				: (this.translateOrNull(key) ?? item.title ?? '')
			: (item.title ?? '');

		return { label, link: typeof item.link === 'string' ? this.toPath(item.link) : null };
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
		const [path = ''] = String(url ?? '').split(/[?#;]/);
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
