import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink, UrlTree } from '@angular/router';
import { map } from 'rxjs/operators';
import {
	NbButtonModule,
	NbIconModule,
	NbInputModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { BaseEntityEnum, ComponentLayoutStyleEnum } from '@gauzy/contracts';
import { ComponentEnum } from '@gauzy/ui-core/common';
import { FavoriteService, FavoriteStoreService, IFavoriteEntry, Store, ToastrService } from '@gauzy/ui-core/core';

/** A favorite as a row of the page, with its link parsed so query parameters (`?view=full`) survive. */
interface IFavoriteRow extends IFavoriteEntry {
	url: UrlTree;
	/** The singular name of the record's type ("Task", "Project"), as a translation key. */
	typeKey: string;
}

/** One tab of the type strip: a kind of record the user has favorites of. */
interface IFavoriteTypeTab {
	entity: BaseEntityEnum;
	labelKey: string;
	count: number;
}

/** `OrganizationProject` → `ORGANIZATION_PROJECT`, the key of a type's names in `FAVORITES`. */
const typeKeyOf = (entity: BaseEntityEnum): string =>
	String(entity)
		.replace(/([a-z0-9])([A-Z])/g, '$1_$2')
		.toUpperCase();

/** The plural name, for a tab: "Tasks". */
const typeLabelKey = (entity: BaseEntityEnum): string => `FAVORITES.TYPES.${typeKeyOf(entity)}`;

/** The singular name, for one favorite: "Task". */
const itemTypeKey = (entity: BaseEntityEnum): string => `FAVORITES.ITEM_TYPES.${typeKeyOf(entity)}`;

/**
 * Every favorite of the signed-in user, newest first. The sidebar lists only the newest few and links here
 * for the rest. Laid out like the Documents page: a search box and a list / cards switch on the toolbar, a
 * tab per kind of record, then the favorites as a table or as cards. Each favorite opens its record, and its
 * star takes it off the favorites.
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
		NbSpinnerModule,
		NbTooltipModule,
		TranslatePipe
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

	/** Cards or table: the user's choice for this page, else their preferred layout, else the app default. */
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

	/** The search text, matched against the favorites' names and descriptions. */
	protected readonly search = signal('');
	/** The type tab picked; `null` is "All". */
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

	/** The count on the "All" tab. */
	protected readonly searchedCount = computed(() => this._searched().length);

	/**
	 * One tab per kind of record the user has favorites of, in the order the newest of each was added. The
	 * tabs come from every favorite so they stay put while typing; the counts follow the search.
	 */
	protected readonly typeTabs = computed<IFavoriteTypeTab[]>(() => {
		const counts = new Map<BaseEntityEnum, number>();
		for (const row of this.rows()) {
			counts.set(row.entity, 0);
		}
		for (const row of this._searched()) {
			counts.set(row.entity, (counts.get(row.entity) ?? 0) + 1);
		}
		return Array.from(counts, ([entity, count]) => ({ entity, labelKey: typeLabelKey(entity), count }));
	});

	/** The tab in force: a picked type nobody has favorites of any more (the last one removed) falls back to All. */
	protected readonly activeType = computed<BaseEntityEnum | null>(() => {
		const selected = this._selectedType();
		return selected && this.typeTabs().some((tab) => tab.entity === selected) ? selected : null;
	});

	protected readonly visibleRows = computed<IFavoriteRow[]>(() => {
		const type = this.activeType();
		const rows = this._searched();
		return type ? rows.filter((row) => row.entity === type) : rows;
	});

	/** The favorite a removal is under way for. Removals run one at a time. */
	protected readonly removingId = signal<string | null>(null);

	protected setLayout(layout: ComponentLayoutStyleEnum): void {
		this._store.setLayoutForComponent(this._viewComponentName, layout);
	}

	protected selectType(type: BaseEntityEnum | null): void {
		this._selectedType.set(type);
	}

	protected onSearch(value: string): void {
		this.search.set(value ?? '');
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
