import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ID, IPagination } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { Campaign } from './campaign.entity';
import { TypeOrmCampaignRepository } from './repository/type-orm-campaign.repository';
import { MikroOrmCampaignRepository } from './repository/mikro-orm-campaign.repository';
import { CampaignStatus, ICampaign, ICampaignCreateInput, ICampaignUpdateInput } from '../promotion.types';
import { TenantScopedCrudService } from '../shared/tenant-scoped-crud.service';

/**
 * Campaigns: the window and the budget a group of promotions runs inside.
 *
 * Every read and every write is scoped to the caller's tenant and organization, so one tenant can
 * never observe another's campaign. The service owns the two rules the table alone cannot express:
 * the identifier is unique per organization, and its window decides whether its promotions are
 * candidates at all.
 */
@Injectable()
export class CampaignService extends TenantScopedCrudService<Campaign> {
	constructor(
		readonly typeOrmCampaignRepository: TypeOrmCampaignRepository,
		readonly mikroOrmCampaignRepository: MikroOrmCampaignRepository
	) {
		super(typeOrmCampaignRepository, mikroOrmCampaignRepository);
	}

	/**
	 * The tenant and organization of the caller, which every query in this service is scoped to.
	 */
	protected get scope(): { tenantId: ID; organizationId: ID } {
		return {
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};
	}

	/**
	 * Creates a campaign inside the caller's tenant and organization.
	 *
	 * @param input The campaign to create.
	 * @returns The stored campaign.
	 * @throws BadRequestException when the identifier is missing or already used in the organization.
	 */
	async createCampaign(input: ICampaignCreateInput): Promise<ICampaign> {
		const identifier = input.identifier?.trim();

		if (!identifier) {
			throw new BadRequestException('CAMPAIGN_IDENTIFIER_REQUIRED');
		}

		// The uniqueness check asks whether the identifier is taken, so one nobody holds is the normal
		// answer rather than a missing resource.
		const existing = await this.typeOrmCampaignRepository.findOneBy({
			...this.scope,
			identifier
		});

		if (existing) {
			throw new BadRequestException(`Campaign "${identifier}" already exists in this organization.`);
		}

		return this.create({ ...input, identifier, ...this.scope } as never);
	}

	/**
	 * Updates a campaign of the caller's organization.
	 *
	 * @param id The campaign to update.
	 * @param input The fields to change.
	 * @returns The stored campaign.
	 * @throws NotFoundException when the campaign is not in the caller's organization.
	 * @throws BadRequestException when the identifier would collide with another campaign.
	 */
	async updateCampaign(id: ID, input: ICampaignUpdateInput): Promise<ICampaign> {
		const campaign = await this.findCampaignOrFail(id);

		if (input.identifier && input.identifier.trim() !== campaign.identifier) {
			const clash = await this.typeOrmCampaignRepository.findOneBy({
				...this.scope,
				identifier: input.identifier.trim()
			});

			if (clash) {
				throw new BadRequestException(`Campaign "${input.identifier}" already exists in this organization.`);
			}
		}

		await this.update(id, { ...input } as never);

		return this.findCampaignOrFail(id);
	}

	/**
	 * Loads a campaign that belongs to the caller's organization.
	 *
	 * @param id The campaign to load.
	 * @returns The campaign.
	 * @throws NotFoundException when it does not exist inside the caller's scope.
	 */
	async findCampaignOrFail(id: ID): Promise<ICampaign> {
		const campaign = await this.findOneByWhereOptions({ id, ...this.scope } as never);

		if (!campaign) {
			throw new NotFoundException('CAMPAIGN_NOT_FOUND');
		}

		return campaign;
	}

	/**
	 * Paginates the campaigns of the caller's organization.
	 *
	 * @param options Optional filters, merged with the tenancy scope.
	 * @returns One page of campaigns.
	 */
	async findCampaigns(options: Record<string, unknown> = {}): Promise<IPagination<ICampaign>> {
		return this.findAll({ ...options, where: { ...((options.where as object) ?? {}), ...this.scope } } as never);
	}

	/**
	 * Whether a campaign's window contains an instant. A null bound means "already open" or "never
	 * closes"; the upper bound is exclusive, so two adjacent campaigns never both claim an instant.
	 *
	 * @param campaign The campaign to test.
	 * @param at The instant to test, defaulting to now.
	 * @returns True when the window is open at that instant.
	 */
	isWindowOpen(campaign: ICampaign, at: Date = new Date()): boolean {
		const startsAt = campaign.startsAt ? new Date(campaign.startsAt) : null;
		const endsAt = campaign.endsAt ? new Date(campaign.endsAt) : null;

		if (startsAt && startsAt > at) {
			return false;
		}

		return !(endsAt && endsAt <= at);
	}

	/**
	 * Whether the campaign admits its promotions at an instant: `ACTIVE` and inside its window.
	 *
	 * @param campaign The campaign to test.
	 * @param at The instant to test.
	 * @returns True when the campaign is running.
	 */
	isRunning(campaign: ICampaign, at: Date = new Date()): boolean {
		return campaign.status === CampaignStatus.ACTIVE && this.isWindowOpen(campaign, at);
	}
}
