import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Params, Router, RouterLink, UrlTree } from '@angular/router';
import { map } from 'rxjs/operators';
import {
	NbButtonModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BaseEntityEnum, ComponentLayoutStyleEnum } from '@gauzy/contracts';
import { ComponentEnum } from '@gauzy/ui-core/common';
import { FavoriteService, FavoriteStoreService, IFavoriteEntry, Store, ToastrService } from '@gauzy/ui-core/core';
import { SmartDataViewLayoutModule } from '@gauzy/ui-core/shared';

/** A favorite as a row of the page, with its link parsed so query parameters (`?view=full`) survive. */
interface IFavoriteRow extends IFavoriteEntry {
	url: UrlTree;
	typeKey: string;
	searchText: string;
}

interface IFavoriteTypeOption {
	entity: BaseEntityEnum;
	labelKey: string;
	count: number;
}

const typeKeyOf = (entity: BaseEntityEnum): string =>
	String(entity)
		.replace(/([a-z0-9])([A-Z])/g, '$1_$2')
		.toUpperCase();

const ALL_TYPES = 'ALL' as const;

const typeLabelKey = (entity: BaseEntityEnum): string => `FAVORITES.TYPES.${typeKeyOf(entity)}`;

const itemTypeKey = (entity: BaseEntityEnum): string => `FAVORITES.ITEM_TYPES.${typeKeyOf(entity)}`;

type FavoritesSort = 'newest' | 'oldest' | 'name' | 'type';

const SORT_OPTIONS: { value: FavoritesSort; labelKey: string }[] = [
	{ value: 'newest', labelKey: 'FAVORITES.SORT.NEWEST' },
	{ value: 'oldest', labelKey: 'FAVORITES.SORT.OLDEST' },
	{ value: 'name', labelKey: 'FAVORITES.SORT.NAME' },
	{ value: 'type', labelKey: 'FAVORITES.SORT.TYPE' }
];

const DEFAULT_SORT: FavoritesSort = 'newest';
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZES = [5, 10, 25, 50, 100];
const URL_SYNC_DELAY_MS = 300;

const ENTITY_TYPES = new Set<string>(Object.values(BaseEntityEnum));

const positiveInt = (value: string | null): number | null => {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

interface IFavoritesQuery {
	search: string;
	type: BaseEntityEnum | null;
	sort: FavoritesSort;
	page: number;
	size: number;
}

const parseQuery = (params: ParamMap): IFavoritesQuery => {
	const type = params.get('type');
	return {
		search: params.get('q') ?? '',
		type: type && ENTITY_TYPES.has(type) ? (type as BaseEntityEnum) : null,
		sort: SORT_OPTIONS.find((option) => option.value === params.get('sort'))?.value ?? DEFAULT_SORT,
		page: positiveInt(params.get('page')) ?? 1,
		size: PAGE_SIZES.find((size) => size === positiveInt(params.get('size'))) ?? DEFAULT_PAGE_SIZE
	};
};

const toQueryParams = (query: IFavoritesQuery): Params => ({
	q: query.search.trim() || null,
	type: query.type,
	sort: query.sort === DEFAULT_SORT ? null : query.sort,
	page: query.page > 1 ? query.page : null,
	size: query.size === DEFAULT_PAGE_SIZE ? null : query.size
});

const queryKey = (query: IFavoritesQuery): string =>
	Object.values(toQueryParams(query))
		.map((value) => (value === null ? '' : String(value)))
		.join('\u0000');

/**
 * Every favorite of the signed-in user, newest first. The sidebar lists only the newest few and links here
 * for the rest; each row opens its record or takes it off the favorites.
 */
@Component({
	selector: 'ga-favorites',
	standalone: true,
	imports: [
		DatePipe,
		NgTemplateOutlet,
		RouterLink,
		NbButtonModule,
		NbIconModule,
		NbInputModule,
		NbSelectModule,
		NbSpinnerModule,
		NbTooltipModule,
		TranslatePipe,
		SmartDataViewLayoutModule
	],
	templateUrl: './favorites.component.html',
	styleUrls: ['./favorites.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class FavoritesComponent {
	private readonly _favoriteStoreService = inject(FavoriteStoreService);
	private readonly _favoriteService = inject(FavoriteService);
	private readonly _toastrService = inject(ToastrService);
	private readonly _router = inject(Router);
	private readonly _route = inject(ActivatedRoute);
	private readonly _store = inject(Store);
	private readonly _translateService = inject(TranslateService);
	private readonly _initialQuery = parseQuery(this._route.snapshot.queryParamMap);
	private _urlSyncTimer: ReturnType<typeof setTimeout> | undefined;
	private _lastWrittenKey: string | null = null;

	private readonly _language = toSignal(
		this._translateService.onLangChange.pipe(map((event) => event.lang)),
		{ initialValue: this._translateService.currentLang }
	);

	protected readonly layoutStyles = ComponentLayoutStyleEnum;
	private readonly _viewComponentName = ComponentEnum.FAVORITES;

	protected readonly cardsView = toSignal(
		this._store
			.componentLayout$(this._viewComponentName)
			.pipe(map((layout) => layout === ComponentLayoutStyleEnum.CARDS_GRID)),
		{ initialValue: false }
	);

	protected readonly loading = toSignal(this._favoriteStoreService.loading$, { initialValue: true });
	/** The last read failed, in full or for some kinds of record: the list may be short. */
	protected readonly loadFailed = toSignal(this._favoriteStoreService.loadFailed$, { initialValue: false });

	private readonly _entries = toSignal(this._favoriteStoreService.favorites$, { initialValue: [] });

	protected readonly rows = computed<IFavoriteRow[]>(() =>
		this._entries().map((entry) => ({
			...entry,
			url: this._router.parseUrl(entry.link),
			typeKey: itemTypeKey(entry.entity),
			searchText: `${entry.title}\n${entry.description ?? ''}`.toLocaleLowerCase()
		}))
	);

	protected readonly search = signal(this._initialQuery.search);
	private readonly _selectedType = signal<BaseEntityEnum | null>(this._initialQuery.type);
	protected readonly sortOptions = SORT_OPTIONS;
	protected readonly sort = signal<FavoritesSort>(this._initialQuery.sort);

	private readonly _searched = computed<IFavoriteRow[]>(() => {
		const term = this.search().trim().toLocaleLowerCase();
		const rows = this.rows();
		return term ? rows.filter((row) => row.searchText.includes(term)) : rows;
	});

	protected readonly searchedCount = computed(() => this._searched().length);

	protected readonly typeOptions = computed<IFavoriteTypeOption[]>(() => {
		const counts = new Map<BaseEntityEnum, number>();
		for (const row of this.rows()) {
			counts.set(row.entity, 0);
		}
		for (const row of this._searched()) {
			counts.set(row.entity, (counts.get(row.entity) ?? 0) + 1);
		}
		const selected = this._selectedType();
		if (selected && !counts.has(selected)) {
			counts.set(selected, 0);
		}
		return Array.from(counts, ([entity, count]) => ({ entity, labelKey: typeLabelKey(entity), count }));
	});

	protected readonly activeType = computed<BaseEntityEnum | null>(() => this._selectedType());

	protected readonly visibleRows = computed<IFavoriteRow[]>(() => {
		const type = this.activeType();
		const rows = type ? this._searched().filter((row) => row.entity === type) : this._searched();
		return this._sorted(rows, this.sort(), this._language());
	});

	protected readonly hasActiveFilters = computed(() => !!this.search().trim() || !!this.activeType());

	protected readonly itemsPerPage = signal(this._initialQuery.size);
	private readonly _activePage = signal(this._initialQuery.page);

	private readonly _query = computed<IFavoritesQuery>(() => ({
		search: this.search(),
		type: this._selectedType(),
		sort: this.sort(),
		page: this._activePage(),
		size: this.itemsPerPage()
	}));

	protected readonly activePage = computed(() => {
		const pages = Math.max(1, Math.ceil(this.visibleRows().length / this.itemsPerPage()));
		return Math.min(this._activePage(), pages);
	});

	protected readonly pagedRows = computed<IFavoriteRow[]>(() => {
		const size = this.itemsPerPage();
		const start = (this.activePage() - 1) * size;
		return this.visibleRows().slice(start, start + size);
	});

	protected readonly showPagination = computed(
		() => this.visibleRows().length > Math.min(10, this.itemsPerPage())
	);

	protected onPageChange(page: number): void {
		this._activePage.set(page);
	}

	protected onItemsPerPageChange(size: number): void {
		if (size && size !== this.itemsPerPage()) {
			this.itemsPerPage.set(size);
			this._activePage.set(1);
		}
	}

	/** The favorite a removal is under way for. Removals run one at a time. */
	protected readonly removingId = signal<string | null>(null);

	protected setLayout(layout: ComponentLayoutStyleEnum): void {
		this._store.setLayoutForComponent(this._viewComponentName, layout);
	}

	protected readonly allTypes = ALL_TYPES;

	protected onTypeSelected(value: BaseEntityEnum | typeof ALL_TYPES): void {
		this._selectedType.set(value === ALL_TYPES ? null : value);
		this._activePage.set(1);
	}

	protected onSearch(value: string): void {
		this.search.set(value ?? '');
		this._activePage.set(1);
	}

	protected clearSearch(): void {
		this.onSearch('');
	}

	protected onSortSelected(value: FavoritesSort): void {
		this.sort.set(value);
		this._activePage.set(1);
	}

	protected clearFilters(): void {
		this.search.set('');
		this._selectedType.set(null);
		this._activePage.set(1);
	}

	constructor() {
		effect(() => {
			const query = this._query();
			clearTimeout(this._urlSyncTimer);
			this._urlSyncTimer = setTimeout(() => this._writeQuery(query), URL_SYNC_DELAY_MS);
		});

		effect(() => {
			if (this.loading()) {
				return;
			}
			const effectivePage = this.activePage();
			if (this._activePage() !== effectivePage) {
				this._activePage.set(effectivePage);
			}
		});

		this._route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => this._readQuery(params));

		inject(DestroyRef).onDestroy(() => clearTimeout(this._urlSyncTimer));
	}

	private _readQuery(params: ParamMap): void {
		const incoming = parseQuery(params);
		const incomingKey = queryKey(incoming);
		if (incomingKey === this._lastWrittenKey) {
			this._lastWrittenKey = null;
			return;
		}
		if (incomingKey === queryKey(this._query())) {
			return;
		}
		clearTimeout(this._urlSyncTimer);
		this.search.set(incoming.search);
		this._selectedType.set(incoming.type);
		this.sort.set(incoming.sort);
		this.itemsPerPage.set(incoming.size);
		this._activePage.set(incoming.page);
	}

	private _writeQuery(query: IFavoritesQuery): void {
		const key = queryKey(query);
		if (key === queryKey(parseQuery(this._route.snapshot.queryParamMap))) {
			return;
		}
		this._lastWrittenKey = key;
		this._router.navigate([], {
			relativeTo: this._route,
			queryParams: toQueryParams(query),
			queryParamsHandling: 'merge',
			replaceUrl: true
		});
	}

	private _sorted(rows: IFavoriteRow[], sort: FavoritesSort, language: string | undefined): IFavoriteRow[] {
		const compare = (a: string, b: string) => a.localeCompare(b, language || undefined, { sensitivity: 'base' });
		switch (sort) {
			case 'oldest':
				return [...rows].reverse();
			case 'name':
				return [...rows].sort((a, b) => compare(a.title, b.title));
			case 'type': {
				const labels = new Map(
					rows.map((row) => [row.typeKey, this._translateService.instant(row.typeKey) as string])
				);
				return [...rows].sort((a, b) => compare(labels.get(a.typeKey) ?? '', labels.get(b.typeKey) ?? ''));
			}
			default:
				return rows;
		}
	}

	protected retry(): void {
		this._favoriteStoreService.refreshFavorites();
	}

	/**
	 * Takes the user's OWN favorite off. A row that is only an organization pin is not removable here: deleting
	 * it would take the pin away from every admin, which this personal action must never do.
	 */
	protected async remove(row: IFavoriteRow): Promise<void> {
		if (this.removingId() || !row.own) {
			return;
		}

		this.removingId.set(row.favoriteId);
		try {
			await this._favoriteService.delete(row.favoriteId);
			this._favoriteStoreService.refreshFavorites();
			// Only the user's own favorite went: an organization pin of the record keeps it listed, so say so.
			const keptByPin = row.own && row.pinnedForOrganization;
			this._toastrService.success(
				keptByPin ? 'FAVORITES.REMOVED_STILL_PINNED' : 'TOASTR.MESSAGE.FAVORITE_REMOVED',
				{ name: row.title }
			);
		} catch (error) {
			console.error('Error removing favorite:', error);
			this._toastrService.danger('TOASTR.MESSAGE.FAVORITE_ERROR');
		} finally {
			this.removingId.set(null);
		}
	}
}
