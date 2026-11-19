import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
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
	readonly view$: Observable<IFavoritesView>;

	/** The favorite a removal is under way for. */
	removingId: string | null = null;

	constructor(
		private readonly _favoriteStoreService: FavoriteStoreService,
		private readonly _favoriteService: FavoriteService,
		private readonly _toastrService: ToastrService,
		private readonly _router: Router,
		private readonly _cdr: ChangeDetectorRef
	) {
		this.view$ = combineLatest([this._favoriteStoreService.favorites$, this._favoriteStoreService.loading$]).pipe(
			map(([entries, loading]) => ({
				loading,
				rows: entries.map((entry) => ({ ...entry, url: this._router.parseUrl(entry.link) }))
			}))
		);
	}

	async remove(row: IFavoriteRow): Promise<void> {
		if (this.removingId) {
			return;
		}

		this.removingId = row.favoriteId;
		try {
			await this._favoriteService.delete(row.favoriteId);
			this._favoriteStoreService.refreshFavorites();
			this._toastrService.success('TOASTR.MESSAGE.FAVORITE_REMOVED', { name: row.title });
		} catch (error) {
			console.error('Error removing favorite:', error);
			this._toastrService.danger('TOASTR.MESSAGE.FAVORITE_ERROR');
		} finally {
			this.removingId = null;
			this._cdr.markForCheck();
		}
	}
}
