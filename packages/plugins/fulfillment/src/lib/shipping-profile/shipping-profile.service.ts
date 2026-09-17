import { BadRequestException, Injectable } from '@nestjs/common';
import { DeepPartial, FindOptionsWhere } from 'typeorm';
import { ID, IPagination } from '@gauzy/contracts';
import { TenantAwareCrudService } from '@gauzy/core';
import { ShippingProfile } from './shipping-profile.entity';
import { TypeOrmShippingProfileRepository } from './repository/type-orm-shipping-profile.repository';
import { MikroOrmShippingProfileRepository } from './repository/mikro-orm-shipping-profile.repository';
import { ShippingProfileVariant } from '../shipping-profile-variant/shipping-profile-variant.entity';
import { ShippingProfileVariantService } from '../shipping-profile-variant/shipping-profile-variant.service';

/**
 * The sets of variants that ship the same way.
 *
 * Two invariants are owned here, both of them unenforceable by a plain unique constraint and both of
 * them consequential: **one default profile per organization** — two defaults would make a variant's
 * shipping behaviour depend on row order — and **one profile per variant**, which the pivot service
 * enforces by reassigning rather than duplicating.
 */
@Injectable()
export class ShippingProfileService extends TenantAwareCrudService<ShippingProfile> {
	constructor(
		readonly typeOrmShippingProfileRepository: TypeOrmShippingProfileRepository,
		readonly mikroOrmShippingProfileRepository: MikroOrmShippingProfileRepository,
		private readonly pivotService: ShippingProfileVariantService
	) {
		super(typeOrmShippingProfileRepository, mikroOrmShippingProfileRepository);
	}

	/**
	 * Creates a profile, refusing a duplicate code and demoting any previous default.
	 *
	 * @param entity The profile to create.
	 * @returns The created profile.
	 */
	public async create(entity: DeepPartial<ShippingProfile>): Promise<ShippingProfile> {
		if (!entity.code) {
			throw new BadRequestException('SHIPPING_PROFILE_CODE_REQUIRED: a profile needs a code.');
		}

		await this.assertCodeIsFree(entity.code);

		if (entity.isDefault) {
			await this.clearExistingDefault();
		}

		return super.create(entity);
	}

	/**
	 * Updates a profile, keeping the two invariants.
	 *
	 * @param id The profile.
	 * @param entity The fields to change.
	 * @returns The update result or the profile.
	 */
	public async update(id: any, entity: any): Promise<any> {
		if (entity?.code) {
			await this.assertCodeIsFree(entity.code, id as ID);
		}

		if (entity?.isDefault) {
			await this.clearExistingDefault(id as ID);
		}

		return super.update(id, entity);
	}

	/**
	 * Finds the profile a variant ships under, falling back to the organization's default.
	 *
	 * @param variantId The variant.
	 * @returns The profile, or null when the organization has neither an attachment nor a default.
	 */
	public async resolveForVariant(variantId: ID): Promise<ShippingProfile | null> {
		const attachments = (await this.pivotService.findAll({
			where: { variantId }
		})) as IPagination<ShippingProfileVariant>;

		if (attachments.items.length > 0) {
			return this.findOneByIdString(attachments.items[0].profileId);
		}

		const profiles = (await this.findAll({})) as IPagination<ShippingProfile>;

		return profiles.items.find((profile: ShippingProfile) => profile.isDefault) ?? null;
	}

	/**
	 * Attaches a set of variants to a profile and detaches another set.
	 *
	 * @param profileId The profile.
	 * @param changes The variants to add and to remove.
	 * @returns The attachments that exist after the change.
	 */
	public async assignVariants(
		profileId: ID,
		changes: { add?: ID[]; remove?: ID[] }
	): Promise<ShippingProfileVariant[]> {
		const profile = await this.findOneByIdString(profileId);

		if (!profile) {
			throw new BadRequestException(`SHIPPING_PROFILE_NOT_FOUND: no profile exists with id ${profileId}.`);
		}

		for (const variantId of changes.remove ?? []) {
			const existing = (await this.pivotService.findAll({
				where: { profileId, variantId }
			})) as IPagination<ShippingProfileVariant>;

			for (const attachment of existing.items) {
				await this.pivotService.delete(attachment.id);
			}
		}

		for (const variantId of changes.add ?? []) {
			// A variant belongs to at most one profile: an existing attachment is moved rather than
			// duplicated, so a reassignment cannot leave a variant with two shipping behaviours.
			const existing = (await this.pivotService.findAll({
				where: { variantId }
			})) as IPagination<ShippingProfileVariant>;

			for (const attachment of existing.items) {
				if (attachment.profileId === profileId) {
					continue;
				}

				await this.pivotService.delete(attachment.id);
			}

			if (!existing.items.some((attachment: ShippingProfileVariant) => attachment.profileId === profileId)) {
				await this.pivotService.create({ profileId, variantId } as DeepPartial<ShippingProfileVariant>);
			}
		}

		const attachments = (await this.pivotService.findAll({
			where: { profileId }
		})) as IPagination<ShippingProfileVariant>;

		return attachments.items;
	}

	/**
	 * @param code The code to test.
	 * @param exceptId A profile to exclude from the test, when updating.
	 */
	private async assertCodeIsFree(code: string, exceptId?: ID): Promise<void> {
		const existing = (await this.findOneByWhereOptions({ code } as FindOptionsWhere<ShippingProfile>)) as
			| ShippingProfile
			| null;

		if (existing && existing.id !== exceptId) {
			throw new BadRequestException({
				message: `SHIPPING_PROFILE_CODE_TAKEN: a profile with code ${code} already exists.`,
				code: 'SHIPPING_PROFILE_CODE_TAKEN',
				details: { code, profileId: existing.id }
			});
		}
	}

	/**
	 * Demotes the organization's current default, so that setting a new one cannot leave two.
	 *
	 * @param exceptId The profile being promoted, which is not demoted.
	 */
	private async clearExistingDefault(exceptId?: ID): Promise<void> {
		const profiles = (await this.findAll({})) as IPagination<ShippingProfile>;

		for (const profile of profiles.items) {
			if (profile.isDefault && profile.id !== exceptId) {
				await super.update(profile.id, { isDefault: false } as any);
			}
		}
	}
}
