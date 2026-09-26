import { BadRequestException } from '@nestjs/common';
import { EventSubscriber } from 'typeorm';
import { OrganizationContact } from './organization-contact.entity';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { getDummyImage } from './../core/utils';

/**
 * The two rules a party row is written through, on every path that writes one.
 *
 * **1. `emailKey` mirrors `primaryEmail`.** The column is the normalised (trimmed, lower-cased) form of
 * the address, and it is what the two unique indexes on the table are built from — so it is written
 * *here*, in the same statement that writes the address, rather than by whichever caller remembered to
 * set it. A row whose key described a different address from the one on the row would make duplicate
 * detection answer about an address the party does not have, and a partial update that carries no
 * address leaves the key alone rather than clearing it.
 *
 * **2. `loyaltyPoints` is never negative.** The balance is a cached sum of the `LOYALTY` adjustment
 * movements, so a negative value cannot be produced by the ledger and can only be written by mistake.
 * PostgreSQL and MySQL carry the same rule as `CHK_organization_contact_loyalty_nonneg`; the embedded
 * dialect cannot add a `CHECK` to an existing table, so here the rule is enforced for every dialect at
 * the point of write, and the nightly audit is what checks the rows already stored.
 *
 * Both rules are checked on create and on update, because a rule that only held on insert would be a
 * rule about a row's first state rather than about the row.
 */
@EventSubscriber()
export class OrganizationContactSubscriber extends BaseEntityEventSubscriber<OrganizationContact> {
	/**
	 * Indicates that this subscriber only listen to OrganizationContact events.
	 */
	listenTo() {
		return OrganizationContact;
	}

	/**
	 * Called after an OrganizationContact entity is loaded from the database. This method updates
	 * the entity's image URL, setting it to the existing image's URL, or generating a dummy
	 * image if no image URL is present.
	 *
	 * @param entity The OrganizationContact entity that has been loaded.
	 * @returns {Promise<void>} A promise that resolves when the URL updating process is complete.
	 */
	async afterEntityLoad(entity: OrganizationContact): Promise<void> {
		try {
			// Set imageUrl from the image object's fullUrl, if available. Fall back to existing imageUrl if not.
			if (Object.prototype.hasOwnProperty.call(entity, 'image')) {
				await this.setImageUrl(entity);
			} else if (!entity.imageUrl && entity.name) {
				// Otherwise, generate a dummy image URL based on the first character of the name
				entity.imageUrl = getDummyImage(330, 300, entity.name.charAt(0).toUpperCase());
			}
		} catch (error) {
			console.error(
				'OrganizationContactSubscriber: An error occurred during the afterEntityLoad process:',
				error
			);
		}
	}

	/**
	 * Called before an OrganizationContact entity is inserted or created in the database. This method sets a
	 * default image URL based on the first character of the entity's name if an image URL is not already provided.
	 *
	 * @param entity The OrganizationContact entity that is about to be created.
	 * @returns {Promise<void>} A promise that resolves when the pre-creation processing is complete.
	 */
	async beforeEntityCreate(entity: OrganizationContact): Promise<void> {
		try {
			// Generate a dummy image URL based on the first character of the name, if imageUrl is not provided
			if (!entity.imageUrl && entity.name) {
				entity.imageUrl = getDummyImage(330, 300, entity.name.charAt(0).toUpperCase());
			}
		} catch (error) {
			console.error(
				'OrganizationContactSubscriber: An error occurred during the beforeEntityCreate process:',
				error
			);
		}

		this.beforeWrite(entity);
	}

	/**
	 * Called before an OrganizationContact entity is updated, so that the two rules below hold for a
	 * change to a row the same way they hold for its first state.
	 *
	 * @param entity The OrganizationContact entity that is about to be updated.
	 * @returns {Promise<void>} A promise that resolves when the pre-update processing is complete.
	 */
	async beforeEntityUpdate(entity: OrganizationContact): Promise<void> {
		this.beforeWrite(entity);
	}

	/**
	 * The rules every write of a party row passes through.
	 *
	 * @param entity The row about to be written.
	 * @throws BadRequestException when the row would carry a negative loyalty balance.
	 */
	private beforeWrite(entity: OrganizationContact): void {
		this.mirrorEmailKey(entity);
		this.assertLoyaltyPointsAreNotNegative(entity);
	}

	/**
	 * Keeps `emailKey` equal to the normalised form of `primaryEmail`.
	 *
	 * A write that states no address leaves the key as it was: an update of, say, the credit limit must
	 * not clear the key the duplicate indexes are built from.
	 *
	 * @param entity The row about to be written.
	 */
	private mirrorEmailKey(entity: OrganizationContact): void {
		if (entity?.primaryEmail === undefined) {
			return;
		}

		const address = String(entity.primaryEmail ?? '').trim().toLowerCase();

		// An address that is stated but empty clears the key rather than storing an empty one: the column
		// is nullable precisely so that "this party has no address" is expressible. The write is null and
		// not `undefined`, because `undefined` means "leave this column as it is" to both mappers.
		entity.emailKey = address.length ? address.slice(0, 320) : (null as unknown as string);
	}

	/**
	 * Refuses a negative loyalty balance.
	 *
	 * @param entity The row about to be written.
	 * @throws BadRequestException when the balance is negative.
	 */
	private assertLoyaltyPointsAreNotNegative(entity: OrganizationContact): void {
		const points = entity?.loyaltyPoints;

		if (points === undefined || points === null) {
			return;
		}

		if (Number(points) < 0) {
			throw new BadRequestException(
				`${ApiErrorCode.VALIDATION_FAILED}: a party's loyalty balance is the sum of its LOYALTY movements and is never negative, and '${String(
					points
				)}' was presented.`
			);
		}
	}

	/**
	 * Simulate an asynchronous operation to set the imageUrl.
	 *
	 * @param entity
	 * @returns
	 */
	private setImageUrl(entity: OrganizationContact): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			try {
				// Simulate async operation, e.g., fetching fullUrl from a service
				setTimeout(() => {
					entity.imageUrl = entity.image?.fullUrl ?? entity.imageUrl;
					resolve();
				});
			} catch (error) {
				console.error('OrganizationContactSubscriber: Error during the setImageUrl process:', error);
				reject(null);
			}
		});
	}
}
