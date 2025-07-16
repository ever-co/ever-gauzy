import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { BaseEntityEnum, IFavorite, IOrganization } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { GenericFavoriteService, Store } from '@gauzy/ui-core/core';
import { ToastrService } from '@gauzy/ui-core/core';
import { filter, tap } from 'rxjs/operators';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-favorite-toggle',
	templateUrl: './favorite-toggle.component.html',
	styleUrls: ['./favorite-toggle.component.scss'],
	standalone: false
})
export class FavoriteToggleComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	@Input() entityType: BaseEntityEnum;
	@Input() entityId: string;
	@Input() entityName?: string;
	@Input() size: 'tiny' | 'small' | 'medium' | 'large' | 'giant' = 'small';
	@Input() status: 'basic' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'control' = 'basic';
	@Input() disabled = false;
	@Input() showLabel = false;
	@Input() spacing: 'default' | 'detail' | 'list' = 'default';

	@Output() favoriteToggled = new EventEmitter<{ isFavorite: boolean; favorite?: IFavorite }>();

	public organization: IOrganization;
	public favorites: IFavorite[] = [];
	public loading = false;

	constructor(
		public readonly translateService: TranslateService,
		private readonly _genericFavoriteService: GenericFavoriteService,
		private readonly _store: Store,
		private readonly _toastrService: ToastrService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		// Watch for organization changes
		this._store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => {
					this.organization = organization;
					this._loadFavorites();
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Load favorites for the current entity type
	 */
	private async _loadFavorites(): Promise<void> {
		if (!this.organization || !this.entityType) {
			return;
		}

		try {
			this.favorites = await this._genericFavoriteService.loadFavorites(
				this.entityType,
				this.organization,
				this._store.user?.employee?.id
			);
		} catch (error) {
			console.error('Error loading favorites:', error);
			this.favorites = [];
		}
	}

	/**
	 * Check if the current entity is a favorite
	 */
	get isFavorite(): boolean {
		if (!this.entityId || !this.entityType || !this.favorites) {
			return false;
		}
		return this._genericFavoriteService.isFavorite(this.entityId, this.entityType, this.favorites);
	}

	/**
	 * Get CSS classes for the button based on spacing preference
	 */
	get buttonClasses(): string {
		const baseClass = 'favorite-toggle-button';
		const activeClass = this.isFavorite ? 'favorite-active' : '';
		const spacingClass =
			this.spacing === 'detail'
				? 'favorite-toggle-detail'
				: this.spacing === 'list'
				? 'favorite-toggle-list'
				: '';

		return [baseClass, activeClass, spacingClass].filter(Boolean).join(' ');
	}

	/**
	 * Get the favorite object for the current entity
	 */
	get favoriteObject(): IFavorite | undefined {
		if (!this.entityId || !this.entityType || !this.favorites) {
			return undefined;
		}
		return this._genericFavoriteService.getFavoriteForEntity(this.entityId, this.entityType, this.favorites);
	}

	/**
	 * Get the appropriate icon based on favorite status
	 */
	get icon(): string {
		return this.isFavorite ? 'star' : 'star-outline';
	}

	/**
	 * Get the appropriate icon status based on favorite status
	 */
	get iconStatus(): string {
		return this.isFavorite ? 'warning' : this.status;
	}

	/**
	 * Get the appropriate tooltip text
	 */
	get tooltipText(): string {
		const entityName = this.entityName || 'item';
		return this.isFavorite
			? this.getTranslation('BUTTONS.REMOVE_FROM_FAVORITES', { name: entityName })
			: this.getTranslation('BUTTONS.ADD_TO_FAVORITES', { name: entityName });
	}

	/**
	 * Get the appropriate button label
	 */
	get buttonLabel(): string {
		return this.isFavorite
			? this.getTranslation('BUTTONS.REMOVE_FROM_FAVORITES')
			: this.getTranslation('BUTTONS.ADD_TO_FAVORITES');
	}

	/**
	 * Toggle favorite status
	 */
	async toggleFavorite(): Promise<void> {
		if (!this.entityType || !this.entityId || !this.organization || this.disabled || this.loading) {
			return;
		}

		this.loading = true;

		try {
			await this._genericFavoriteService.toggleFavorite(
				this.entityType,
				this.entityId,
				this.organization,
				this._store.user?.employee?.id,
				this.favorites
			);

			// Reload favorites to get updated state
			await this._loadFavorites();

			// Emit the toggle event
			this.favoriteToggled.emit({
				isFavorite: this.isFavorite,
				favorite: this.favoriteObject
			});

			// Show success message
			const entityName = this.entityName || 'item';
			const messageKey = this.isFavorite ? 'TOASTR.MESSAGE.FAVORITE_ADDED' : 'TOASTR.MESSAGE.FAVORITE_REMOVED';

			this._toastrService.success(messageKey, { name: entityName });
		} catch (error) {
			console.error('Error toggling favorite:', error);
			this._toastrService.danger('TOASTR.MESSAGE.FAVORITE_ERROR');
		} finally {
			this.loading = false;
		}
	}

	ngOnDestroy(): void {}
}
