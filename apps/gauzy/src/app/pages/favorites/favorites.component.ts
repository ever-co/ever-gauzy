import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink, UrlTree } from '@angular/router';
import { map } from 'rxjs/operators';
import {
	NbButtonModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { BaseEntityEnum, ComponentLayoutStyleEnum } from '@gauzy/contracts';
import { ComponentEnum } from '@gauzy/ui-core/common';
import { FavoriteService, FavoriteStoreService, IFavoriteEntry, Store, ToastrService } from '@gauzy/ui-core/core';
import { SmartDataViewLayoutModule } from '@gauzy/ui-core/shared';

/** A favorite as a row of the page, with its link parsed so query parameters (`?view=full`) survive. */
interface IFavoriteRow extends IFavoriteEntry {
	url: UrlTree;
	typeKey: string;
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
	private readonly _store = inject(Store);

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
			typeKey: itemTypeKey(entry.entity)
		}))
	);

	protected readonly search = signal('');
	private readonly _selectedType = signal<BaseEntityEnum | null>(null);

	private readonly _searched = computed<IFavoriteRow[]>(() => {
		const term = this.search().trim().toLocaleLowerCase();
		const rows = this.rows();
		return term
			? rows.filter(
					(row) =>
						row.title.toLocaleLowerCase().includes(term) ||
						!!row.description?.toLocaleLowerCase().includes(term)
			  )
			: rows;
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
		return Array.from(counts, ([entity, count]) => ({ entity, labelKey: typeLabelKey(entity), count }));
	});

	protected readonly activeType = computed<BaseEntityEnum | null>(() => {
		const selected = this._selectedType();
		return selected && this.typeOptions().some((option) => option.entity === selected) ? selected : null;
	});

	protected readonly visibleRows = computed<IFavoriteRow[]>(() => {
		const type = this.activeType();
		const rows = this._searched();
		return type ? rows.filter((row) => row.entity === type) : rows;
	});

	protected readonly itemsPerPage = signal(10);
	private readonly _activePage = signal(1);

	protected readonly activePage = computed(() => {
		const pages = Math.max(1, Math.ceil(this.visibleRows().length / this.itemsPerPage()));
		return Math.min(this._activePage(), pages);
	});

	protected readonly pagedRows = computed<IFavoriteRow[]>(() => {
		const size = this.itemsPerPage();
		const start = (this.activePage() - 1) * size;
		return this.visibleRows().slice(start, start + size);
	});

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
