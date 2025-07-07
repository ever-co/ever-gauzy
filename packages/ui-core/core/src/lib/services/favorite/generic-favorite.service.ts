import { Injectable } from '@angular/core';
import { BaseEntityEnum, IFavorite, IFavoriteCreateInput, PermissionsEnum, IOrganization } from '@gauzy/contracts';
import { Store } from '../store/store.service';
import { FavoriteService } from './favorite.service';
import { FavoriteStoreService } from './favorite-store.service';

@Injectable({ providedIn: 'root' })
export class GenericFavoriteService {
	constructor(
		private readonly favoriteService: FavoriteService,
		private readonly favoriteStoreService: FavoriteStoreService,
		private readonly store: Store
	) {}

	/**
	 * Loads the list of favorites for a given entity type, for the current user or all for admin.
	 * @param entityType The BaseEntityEnum type (e.g., Employee, OrganizationProject, etc.)
	 * @param organization The current organization
	 * @param employeeId (optional) The employee ID (if not admin)
	 */
	async loadFavorites(
		entityType: BaseEntityEnum,
		organization: IOrganization,
		employeeId?: string
	): Promise<IFavorite[]> {
		const { id: organizationId, tenantId } = organization || {};
		if (!organizationId || !tenantId) {
			return [];
		}
		const isAdmin = this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_VIEW);
		let items: IFavorite[] = [];
		if (isAdmin && !employeeId) {
			// Admin: fetch all favorites for the organization
			const result = await this.favoriteService.findAll({
				where: {
					organizationId,
					tenantId,
					entity: entityType
				}
			});
			items = result.items;
		} else {
			// Normal user: fetch only the current employee's favorites
			const effectiveEmployeeId = employeeId || this.store.user?.employee?.id;
			if (!effectiveEmployeeId) {
				return [];
			}
			const result = await this.favoriteService.findByEmployee({
				where: {
					organizationId,
					tenantId,
					employeeId: effectiveEmployeeId,
					entity: entityType
				}
			});
			items = result.items;
		}
		return items;
	}

	/**
	 * Adds or removes an entity from favorites, then refreshes the sidebar menu.
	 * @param entityType The BaseEntityEnum type
	 * @param entityId The ID of the entity
	 * @param organization The current organization
	 * @param employeeId (optional) The employee ID
	 * @param currentFavorites The current list of favorites for this entity type
	 */
	async toggleFavorite(
		entityType: BaseEntityEnum,
		entityId: string,
		organization: IOrganization,
		employeeId: string | undefined,
		currentFavorites: IFavorite[]
	): Promise<void> {
		if (!entityType || !entityId || !organization?.id || !organization?.tenantId) {
			throw new Error('Invalid parameters: entityType, entityId, and organization with id/tenantId are required');
		}
		if (!Array.isArray(currentFavorites)) {
			throw new Error('currentFavorites must be an array');
		}
		try {
			const isFav = this.isFavorite(entityId, entityType, currentFavorites);
			if (isFav) {
				// Remove from favorites
				const fav = this.getFavoriteForEntity(entityId, entityType, currentFavorites);
				if (fav) {
					await this.favoriteService.delete(fav.id);
				}
			} else {
				// Add to favorites
				const { id: organizationId, tenantId } = organization;
				const effectiveEmployeeId = employeeId || this.store.user?.employee?.id;
				const input: IFavoriteCreateInput = {
					entity: entityType,
					entityId,
					organizationId,
					tenantId,
					employeeId: effectiveEmployeeId
				};
				await this.favoriteService.create(input);
			}
			// Refresh the sidebar menu
			// Refresh the sidebar menu
			this.favoriteStoreService.refreshFavorites();
		} catch (error) {
			console.error('Error toggling favorite:', error);
			throw new Error('Failed to update favorite status');
		}
	}

	/**
	 * Checks if an entity is a favorite in the provided list.
	 * @param entityId The ID of the entity
	 * @param entityType The BaseEntityEnum type
	 * @param favorites The list of favorites
	 */
	isFavorite(entityId: string, entityType: BaseEntityEnum, favorites: IFavorite[]): boolean {
		return favorites.some((fav) => fav.entityId === entityId && fav.entity === entityType);
	}

	/**
	 * Finds the favorite object for a given entity in the provided list.
	 * @param entityId The ID of the entity
	 * @param entityType The BaseEntityEnum type
	 * @param favorites The list of favorites
	 */
	getFavoriteForEntity(entityId: string, entityType: BaseEntityEnum, favorites: IFavorite[]): IFavorite | undefined {
		return favorites.find((fav) => fav.entityId === entityId && fav.entity === entityType);
	}
}
