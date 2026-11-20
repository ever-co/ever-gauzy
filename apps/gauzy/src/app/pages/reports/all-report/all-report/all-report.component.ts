import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IGetReportCategory, IOrganization, IReport, IReportCategory, PermissionsEnum } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import { chain } from 'underscore';
import { Store } from '@gauzy/ui-core/core';
import { ReportService } from '../report.service';

/** Which reports to show by their "show in menu" switch. */
export type ReportMenuFilter = 'all' | 'shown' | 'hidden';

const MENU_FILTERS: ReportMenuFilter[] = ['all', 'shown', 'hidden'];

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
	public reportCategories: IReportCategory[] = [];

	/** The categories and reports left once the filters below are applied. */
	public filteredCategories: IReportCategory[] = [];

	public readonly menuFilters = MENU_FILTERS;

	/** Free text matched against each report's name, description and category. */
	public search = '';
	/** A category id, or `null` for every category. */
	public categoryId: string | null = null;
	public menuFilter: ReportMenuFilter = 'all';

	public totalCount = 0;
	public filteredCount = 0;

	/** Reports each option of the two selects would show; see `applyFilters`. */
	public categoryCounts: Record<string, number> = {};
	public allCategoriesCount = 0;
	public menuCounts: Record<ReportMenuFilter, number> = { all: 0, shown: 0, hidden: 0 };

	constructor(
		private readonly reportService: ReportService,
		private readonly store: Store,
		private readonly route: ActivatedRoute,
		private readonly router: Router
	) {}

	ngOnInit(): void {
		this.readFiltersFromUrl();

		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.getReports()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/** The picked category's name for the select's trigger, or `null` for all of them. */
	get selectedCategoryName(): string | null {
		return this.reportCategories.find((category) => category.id === this.categoryId)?.name ?? null;
	}

	/** True while any filter narrows the list. */
	get hasActiveFilters(): boolean {
		return !!normalize(this.search) || !!this.categoryId || this.menuFilter !== 'all';
	}

	onSearchChange(value: string): void {
		this.search = value ?? '';
		this.onFiltersChange();
	}

	/** `'all'` is the select's own value for "every category". */
	onCategoryChange(categoryId: string): void {
		this.categoryId = categoryId && categoryId !== 'all' ? categoryId : null;
		this.onFiltersChange();
	}

	onMenuFilterChange(menuFilter: ReportMenuFilter): void {
		this.menuFilter = MENU_FILTERS.includes(menuFilter) ? menuFilter : 'all';
		this.onFiltersChange();
	}

	resetFilters(): void {
		this.search = '';
		this.categoryId = null;
		this.menuFilter = 'all';
		this.onFiltersChange();
	}

	/**
	 * Updates the 'show in menu' status of a report.
	 *
	 * The filtered list is deliberately not recomputed here: with "Hidden from
	 * menu" selected, switching a report on would otherwise pull its card out
	 * from under the pointer. It drops out on the next filter change instead.
	 *
	 * @param isEnabled Indicates whether the report should be shown in the menu.
	 * @param report The report to update.
	 */
	async updateShowInMenu(isEnabled: boolean, report): Promise<void> {
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
		try {
			this.loading = true;

			const { id: organizationId, tenantId } = this.organization;
			const request: IGetReportCategory = {
				organizationId,
				tenantId,
				relations: ['category']
			};

			const { items = [] } = await this.reportService.getReports(request);

			const categories = chain(items).groupBy('categoryId');
			this.reportCategories = categories
				.map((reports: IReport[]) => ({
					...reports[0].category,
					reports
				}))
				.value();

			// A category kept from the URL or from another organization that this
			// one does not have would otherwise leave the page empty for no visible
			// reason.
			if (this.categoryId && !this.reportCategories.some((category) => category.id === this.categoryId)) {
				this.categoryId = null;
				this.writeFiltersToUrl();
			}
			this.applyFilters();
		} catch (error) {
			console.log('Error while retrieving report with category', error);
		} finally {
			this.loading = false;
		}
	}

	private onFiltersChange(): void {
		this.applyFilters();
		this.writeFiltersToUrl();
	}

	/**
	 * Narrows `reportCategories` into `filteredCategories`. Every word of the
	 * search has to appear somewhere in the report's name, description or
	 * category name, in any order. A category with no report left is dropped.
	 */
	private applyFilters(): void {
		const terms = normalize(this.search).split(/\s+/).filter(Boolean);
		const matchesSearch = (report: IReport, categoryName: string): boolean => {
			if (!terms.length) {
				return true;
			}
			const haystack = `${normalize(report.name)} ${normalize(report.description)} ${categoryName}`;
			return terms.every((term) => haystack.includes(term));
		};
		const matchesMenu = (report: IReport, menuFilter: ReportMenuFilter): boolean =>
			menuFilter === 'all' || (menuFilter === 'shown' ? !!report.showInMenu : !report.showInMenu);

		const categoryCounts: Record<string, number> = {};
		const menuCounts: Record<ReportMenuFilter, number> = { all: 0, shown: 0, hidden: 0 };
		let total = 0;

		const filtered: IReportCategory[] = [];
		for (const category of this.reportCategories) {
			const categoryName = normalize(category.name);
			const inCategory = !this.categoryId || category.id === this.categoryId;
			const reports: IReport[] = [];
			categoryCounts[category.id] = 0;

			for (const report of category.reports || []) {
				total++;
				if (!matchesSearch(report, categoryName)) {
					continue;
				}
				// Each select counts what its options would show with every OTHER
				// filter applied, so picking an option never lands on a surprise.
				if (matchesMenu(report, this.menuFilter)) {
					categoryCounts[category.id]++;
				}
				if (inCategory) {
					menuCounts.all++;
					menuCounts[report.showInMenu ? 'shown' : 'hidden']++;
					if (matchesMenu(report, this.menuFilter)) {
						reports.push(report);
					}
				}
			}
			if (reports.length) {
				filtered.push({ ...category, reports });
			}
		}

		this.filteredCategories = filtered;
		this.categoryCounts = categoryCounts;
		this.menuCounts = menuCounts;
		this.allCategoriesCount = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);
		this.totalCount = total;
		this.filteredCount = filtered.reduce((sum, category) => sum + category.reports.length, 0);
	}

	/** Restores the filters from `?q=&category=&menu=`, so a reload or Back keeps them. */
	private readFiltersFromUrl(): void {
		const params = this.route.snapshot.queryParamMap;
		this.search = params.get('q') || '';
		this.categoryId = params.get('category') || null;
		const menu = params.get('menu') as ReportMenuFilter;
		this.menuFilter = MENU_FILTERS.includes(menu) ? menu : 'all';
	}

	/** Mirrors the filters into the URL without adding a history entry per keystroke. */
	private writeFiltersToUrl(): void {
		const q = this.search.trim();
		this.router.navigate([], {
			relativeTo: this.route,
			queryParams: {
				q: q || null,
				category: this.categoryId || null,
				menu: this.menuFilter !== 'all' ? this.menuFilter : null
			},
			queryParamsHandling: 'merge',
			replaceUrl: true
		});
	}
}
