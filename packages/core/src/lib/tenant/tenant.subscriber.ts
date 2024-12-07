import { EventSubscriber } from 'typeorm';
import { getTenantLogo } from '../core/utils';
import { Tenant } from './tenant.entity';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';

@EventSubscriber()
export class TenantSubscriber extends BaseEntityEventSubscriber<Tenant> {
	/**
	 * Indicates that this subscriber only listen to Organization events.
	 */
	listenTo() {
		return Tenant;
	}

	/**
	 * Executes after a Tenant entity is loaded. It updates the entity's logo
	 * using `updateTenantLogo`. Errors during this process are logged.
	 *
	 * @param entity The loaded Tenant entity.
	 * @returns {Promise<void>}
	 */
	async afterEntityLoad(entity: Tenant): Promise<void> {
		try {
			await this.updateTenantLogo(entity);
		} catch (error) {
			console.error('TenantSubscriber: An error occurred during the afterEntityLoad process:', error);
		}
	}

	/**
	 * Invoked before creating a new Tenant entity. It sets or updates the logo
	 * through `updateTenantLogo`. Errors are logged for troubleshooting.
	 *
	 * @param entity The Tenant entity to be created.
	 */
	async beforeEntityCreate(entity: Tenant) {
		try {
			await this.updateTenantLogo(entity);
		} catch (error) {
			console.error('TenantSubscriber: An error occurred during the beforeEntityCreate process:', error);
		}
	}

	/**
	 * Called before a Tenant entity is updated in the database. This method updates
	 * the tenant's logo as necessary before the actual database update occurs.
	 *
	 * @param entity The Tenant entity that is about to be updated.
	 * @returns {Promise<void>} A promise that resolves when the pre-update processing is complete.
	 */
	async beforeEntityUpdate(entity: Tenant): Promise<void> {
		try {
			// Update the tenant's logo, if applicable
			await this.updateTenantLogo(entity);
		} catch (error) {
			console.error('TenantSubscriber: An error occurred during the beforeEntityUpdate process:', error);
		}
	}

	/**
	 * Updates the logo for a Tenant entity.
	 *
	 * @param entity - The Tenant entity for which the logo is to be updated.
	 * @returns A promise that resolves when the logo update is complete.
	 */
	async updateTenantLogo(entity: Tenant): Promise<void> {
		try {
			if (!entity.logo) {
				entity.logo = getTenantLogo(entity.name);
			}

			// Set imageUrl from the image object's fullUrl, if available. Fall back to existing imageUrl if not.
			if (Object.prototype.hasOwnProperty.call(entity, 'image')) {
				await this.setImageUrl(entity);
			}
		} catch (error) {
			console.error('TenantSubscriber: An error occurred during the updateTenantLogo process:', error);
		}
	}

	/**
	 * Simulate an asynchronous operation to set the logo.
	 *
	 * @param entity
	 * @returns
	 */
	private setImageUrl(entity: Tenant): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			try {
				// Simulate async operation, e.g., fetching fullUrl from a service
				setTimeout(() => {
					entity.logo = entity.image?.fullUrl ?? entity.logo;
					resolve();
				});
			} catch (error) {
				console.error('UserSubscriber: Error during the setImageUrl process:', error);
				reject(null);
			}
		});
	}
}
