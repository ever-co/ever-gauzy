import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, UrlTree } from '@angular/router';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { NbButtonModule, NbCardModule, NbIconModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { FavoriteService, FavoriteStoreService, IFavoriteEntry, ToastrService } from '@gauzy/ui-core/core';

/** A favorite as a row of the page, with its link parsed so query parameters (`?view=full`) survive. */
interface IFavoriteRow extends IFavoriteEntry {
	url: UrlTree;
}

interface IFavoritesView {
	loading: boolean;
	/** The last read failed, in full or for some kinds of record: the list may be short. */
	loadFailed: boolean;
	rows: IFavoriteRow[];
}

/**
 * Every favorite of the signed-in user, newest first. The sidebar lists only the newest few and links here
 * for the rest; each row opens its record or takes it off the favorites.
 */
@Component({
	selector: 'ga-favorites',
	standalone: true,
	imports: [
		AsyncPipe,
		RouterLink,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
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

	protected readonly view$: Observable<IFavoritesView> = combineLatest([
		this._favoriteStoreService.favorites$,
		this._favoriteStoreService.loading$,
		this._favoriteStoreService.loadFailed$
	]).pipe(
		map(([entries, loading, loadFailed]) => ({
			loading,
			loadFailed,
			rows: entries.map((entry) => ({ ...entry, url: this._router.parseUrl(entry.link) }))
		}))
	);

	/** The favorite a removal is under way for. Removals run one at a time. */
	protected readonly removingId = signal<string | null>(null);

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
