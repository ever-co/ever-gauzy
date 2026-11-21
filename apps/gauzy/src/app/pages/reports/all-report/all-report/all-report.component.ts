import { Component, OnInit, ChangeDetectionStrategy, computed, signal } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { IGetReportCategory, IOrganization, IReport, IReportCategory, PermissionsEnum } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import { chain } from 'underscore';
import { Store } from '@gauzy/ui-core/core';
import { ReportService } from '../report.service';

/** Which reports to show by their "show in menu" switch. */
export type ReportMenuFilter = 'all' | 'shown' | 'hidden';

const MENU_FILTERS: ReportMenuFilter[] = ['all', 'shown', 'hidden'];

/** How many reports each option of the two selects would show. */
export interface ReportOptionCounts {
	/** Per category id, with the search and menu filters applied. */
	categories: Record<string, number>;
	/** The "All categories" option: the sum of the above. */
	allCategories: number;
	/** Per menu option, with the search and category filters applied. */
	menu: Record<ReportMenuFilter, number>;
	/** Every report the organization has, unfiltered. */
	total: number;
}

/**
 * Lower-cases a string and strips its accents, so "rapport" finds "Rapport"
 * and "resume" finds "Résumé".
 */
function normalize(value: string): string {
	return (value || '')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.trim();
}

/** Every search word has to appear in the report's name, description or category name, in any order. */
function matchesSearch(report: IReport, category: IReportCategory, terms: string[]): boolean {
	if (!terms.length) {
		return true;
	}
	const haystack = `${normalize(report.name)} ${normalize(report.description)} ${normalize(category.name)}`;
	return terms.every((term) => haystack.includes(term));
}

function matchesMenu(report: IReport, menuFilter: ReportMenuFilter): boolean {
	return menuFilter === 'all' || (menuFilter === 'shown' ? !!report.showInMenu : !report.showInMenu);
}

@UntilDestroy()
@Component({
    selector: 'ga-all-report',
    templateUrl: './all-report.component.html',
    styleUrls: ['./all-report.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AllReportComponent implements OnInit {
	PermissionsEnum = PermissionsEnum;
	public organization: IOrganization;
	public loading: boolean;

	/** Every report of the organization, grouped by category. */
	public readonly reportCategories = signal<IReportCategory[]>([]);

	// ── Filters (mirrored in the URL as `?q=&category=&menu=`) ──────────────
	/** Free text matched against each report's name, description and category. */
	public readonly search = signal('');
	/** A category id, or `null` for every category. */
	public readonly categoryId = signal<string | null>(null);
	public readonly menuFilter = signal<ReportMenuFilter>('all');

	/**
	 * Bumped whenever a report's "show in menu" switch changes. Only the option
	 * counts read it: they follow the switch at once, while the list below keeps
	 * the card that was switched (see `filteredCategories`).
	 */
	private readonly menuStateVersion = signal(0);

	private readonly searchTerms = computed(() => normalize(this.search()).split(/\s+/).filter(Boolean));

	/**
	 * The categories and reports left once the filters are applied; a category
	 * with no report left is dropped.
	 *
	 * Deliberately NOT a dependent of `menuStateVersion`: with "Hidden from menu"
	 * selected, switching a report on would otherwise pull its card out from
	 * under the pointer. It drops out on the next filter change instead.
	 */
	public readonly filteredCategories = computed<IReportCategory[]>(() => {
		const terms = this.searchTerms();
		const categoryId = this.categoryId();
		const menuFilter = this.menuFilter();

		return this.reportCategories()
			.filter((category) => !categoryId || category.id === categoryId)
			.map((category) => ({
				...category,
				reports: (category.reports || []).filter(
					(report) => matchesSearch(report, category, terms) && matchesMenu(report, menuFilter)
				)
			}))
			.filter((category) => category.reports.length > 0);
	});

	/**
	 * Each select counts what its options would show with every OTHER filter
	 * applied, so picking an option never lands on a surprise. These follow the
	 * menu switches as they change.
	 */
	public readonly optionCounts = computed<ReportOptionCounts>(() => {
		this.menuStateVersion();
		const terms = this.searchTerms();
		const categoryId = this.categoryId();
		const menuFilter = this.menuFilter();

		const counts: ReportOptionCounts = {
			categories: {},
			allCategories: 0,
			menu: { all: 0, shown: 0, hidden: 0 },
			total: 0
		};
		for (const category of this.reportCategories()) {
			const inCategory = !categoryId || category.id === categoryId;
			counts.categories[category.id] = 0;

			for (const report of category.reports || []) {
				counts.total++;
				if (!matchesSearch(report, category, terms)) {
					continue;
				}
				if (matchesMenu(report, menuFilter)) {
					counts.categories[category.id]++;
					counts.allCategories++;
				}
				if (inCategory) {
					counts.menu.all++;
					counts.menu[report.showInMenu ? 'shown' : 'hidden']++;
				}
			}
		}
		return counts;
	});

	public readonly filteredCount = computed(() =>
		this.filteredCategories().reduce((sum, category) => sum + category.reports.length, 0)
	);

	/** The picked category's name for the select's trigger, or `null` for all of them. */
	public readonly selectedCategoryName = computed(
		() => this.reportCategories().find((category) => category.id === this.categoryId())?.name ?? null
	);

	/** True while any filter narrows the list. */
	public readonly hasActiveFilters = computed(
		() => this.searchTerms().length > 0 || !!this.categoryId() || this.menuFilter() !== 'all'
	);

	/** URL writes still in flight; the query-param echo of our own writes is ignored. */
	private pendingUrlWrites = 0;
	/** Increments per report request, so only the latest response is applied. */
	private reportsRequest = 0;

	constructor(
		private readonly reportService: ReportService,
		private readonly store: Store,
		private readonly route: ActivatedRoute,
		private readonly router: Router
	) {}

	ngOnInit(): void {
		// Not a one-off snapshot: the router reuses this component when only the
		// query changes (the sidebar's "All Reports" link drops it, for one), and
		// the controls have to follow the URL then too.
		this.route.queryParamMap
			.pipe(
				tap((params: ParamMap) => this.readFiltersFromUrl(params)),
				untilDestroyed(this)
			)
			.subscribe();

		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.getReports()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	onSearchChange(value: string): void {
		this.search.set(value ?? '');
		this.writeFiltersToUrl();
	}

	/** `'all'` is the select's own value for "every category". */
	onCategoryChange(categoryId: string): void {
		this.categoryId.set(categoryId && categoryId !== 'all' ? categoryId : null);
		this.writeFiltersToUrl();
	}

	onMenuFilterChange(menuFilter: ReportMenuFilter): void {
		this.menuFilter.set(MENU_FILTERS.includes(menuFilter) ? menuFilter : 'all');
		this.writeFiltersToUrl();
	}

	resetFilters(): void {
		this.search.set('');
		this.categoryId.set(null);
		this.menuFilter.set('all');
		this.writeFiltersToUrl();
	}

	/**
	 * Updates the 'show in menu' status of a report.
	 *
	 * `ngModel` has already flipped `report.showInMenu`; the option counts are
	 * refreshed from that at once, the list keeps the card (see
	 * `filteredCategories`).
	 *
	 * @param isEnabled Indicates whether the report should be shown in the menu.
	 * @param report The report to update.
	 */
	async updateShowInMenu(isEnabled: boolean, report): Promise<void> {
		this.menuStateVersion.update((version) => version + 1);
		try {
			const { id: organizationId, tenantId } = this.organization;

			await this.reportService.updateReport({
				reportId: report.id,
				organizationId,
				tenantId,
				isEnabled
			});

			await this.reportService.getReportMenuItems({
				organizationId,
				tenantId
			});
		} catch (error) {
			console.error(`Error occurred while updating 'show in menu' status: ${error.message}`);
		}
	}

	/**
	 * Retrieves all reports for the current organization.
	 *
	 * @returns A promise that resolves when reports are successfully retrieved.
	 */
	async getReports() {
		if (!this.organization) {
			return false;
		}
		const request = ++this.reportsRequest;
		try {
			this.loading = true;

			const { id: organizationId, tenantId } = this.organization;
			const params: IGetReportCategory = {
				organizationId,
				tenantId,
				relations: ['category']
			};

			const { items = [] } = await this.reportService.getReports(params);

			// A slower response for an organization switched away from must not
			// replace the current one's reports, nor judge its category filter.
			if (request !== this.reportsRequest) {
				return;
			}

			const categories = chain(items).groupBy('categoryId');
			this.reportCategories.set(
				categories
					.map((reports: IReport[]) => ({
						...reports[0].category,
						reports
					}))
					.value()
			);

			// A category kept from the URL or from another organization that this
			// one does not have would otherwise leave the page empty for no visible
			// reason.
			const categoryId = this.categoryId();
			if (categoryId && !this.reportCategories().some((category) => category.id === categoryId)) {
				this.categoryId.set(null);
				this.writeFiltersToUrl();
			}
		} catch (error) {
			console.log('Error while retrieving report with category', error);
		} finally {
			if (request === this.reportsRequest) {
				this.loading = false;
			}
		}
	}

	/**
	 * Applies the filters in the URL. Skipped while one of our own writes is in
	 * flight: that emission only echoes state the controls already hold, and an
	 * older echo arriving mid-typing would otherwise overwrite newer keystrokes.
	 */
	private readFiltersFromUrl(params: ParamMap): void {
		if (this.pendingUrlWrites > 0) {
			return;
		}
		this.search.set(params.get('q') || '');
		this.categoryId.set(params.get('category') || null);
		const menu = params.get('menu') as ReportMenuFilter;
		this.menuFilter.set(MENU_FILTERS.includes(menu) ? menu : 'all');
	}

	/** Mirrors the filters into the URL without adding a history entry per keystroke. */
	private writeFiltersToUrl(): void {
		const q = this.search().trim();
		this.pendingUrlWrites++;
		this.router
			.navigate([], {
				relativeTo: this.route,
				queryParams: {
					q: q || null,
					category: this.categoryId() || null,
					menu: this.menuFilter() !== 'all' ? this.menuFilter() : null
				},
				queryParamsHandling: 'merge',
				replaceUrl: true
			})
			.finally(() => this.pendingUrlWrites--);
	}
}
