import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FindManyOptions } from 'typeorm';
import { ID, IPagination } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { OrderReturnReason } from './order-return-reason.entity';
import { MikroOrmOrderReturnReasonRepository } from './repository/mikro-orm-order-return-reason.repository';
import { TypeOrmOrderReturnReasonRepository } from './repository/type-orm-order-return-reason.repository';

/**
 * The governed reason codes a return can be filed under.
 *
 * Two rules make this more than a lookup table. The tree is two levels deep — a reason and its
 * variants — because that is the depth a return form can present without becoming a taxonomy. And a
 * used reason is deactivated, never deleted: the returns already filed against it are grouped by its
 * code, so removing the row would leave them unexplainable in a report.
 */
@Injectable()
export class OrderReturnReasonService extends TenantAwareCrudService<OrderReturnReason> {
	constructor(
		readonly typeOrmOrderReturnReasonRepository: TypeOrmOrderReturnReasonRepository,
		readonly mikroOrmOrderReturnReasonRepository: MikroOrmOrderReturnReasonRepository
	) {
		super(typeOrmOrderReturnReasonRepository, mikroOrmOrderReturnReasonRepository);
	}

	/**
	 * Creates a reason. The code is unique inside the organization, which is what makes it usable as
	 * a reporting key.
	 *
	 * @param entity The reason to create.
	 * @returns The created reason.
	 * @throws BadRequestException when the code is missing or already used, or when the proposed
	 * parent is itself a variant.
	 */
	public async create(entity: Partial<OrderReturnReason>): Promise<OrderReturnReason> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const code = (entity.code ?? '').trim();

		if (!code) {
			throw new BadRequestException('A return reason needs a code.');
		}

		const existing = await this.typeOrmOrderReturnReasonRepository.findOne({
			where: { tenantId, organizationId, code }
		});

		if (existing) {
			throw new BadRequestException(`A return reason with the code "${code}" already exists.`);
		}

		if (entity.parentId) {
			await this.assertRootParent(entity.parentId, organizationId);
		}

		return await super.create({
			...entity,
			code,
			tenantId,
			organizationId
		} as any);
	}

	/**
	 * Updates a reason. The code is immutable once the reason exists, because the returns already
	 * filed against it are grouped by that code.
	 *
	 * @param id The reason to update.
	 * @param entity The fields to change.
	 * @returns The updated reason.
	 */
	public async update(id: ID, entity: Partial<OrderReturnReason>): Promise<OrderReturnReason> {
		const reason = await this.findOneScoped(id);

		if (entity.code !== undefined && entity.code !== reason.code) {
			throw new BadRequestException(
				'The code of a return reason cannot change: returns already filed against it are grouped by that code.'
			);
		}

		if (entity.parentId) {
			if (entity.parentId === id) {
				throw new BadRequestException('A return reason cannot be its own parent.');
			}

			await this.assertRootParent(entity.parentId, reason.organizationId);
		}

		return await super.update(id, entity as any);
	}

	/**
	 * Deactivates a reason, keeping the row so the returns that reference it keep explaining
	 * themselves. This is what the delete endpoint does; the soft delete remains available for a row
	 * that was never used.
	 *
	 * @param id The reason to deactivate.
	 * @returns The deactivated reason.
	 */
	public async deactivate(id: ID): Promise<OrderReturnReason> {
		await this.findOneScoped(id);

		return await super.update(id, { isActive: false } as any);
	}

	/**
	 * Lists the reasons as a two-level tree, roots first, so a caller can render a picker from one
	 * response.
	 *
	 * @param filter Optional extra filter.
	 * @returns The reasons, paginated like every other listing.
	 */
	public async findTree(filter?: FindManyOptions<OrderReturnReason>): Promise<IPagination<OrderReturnReason>> {
		const result = await this.paginate(filter);

		const roots = result.items.filter((reason) => !reason.parentId);
		const variants = result.items.filter((reason) => !!reason.parentId);

		if (!roots.length) {
			return result;
		}

		for (const root of roots) {
			root.children = variants.filter((variant) => variant.parentId === root.id);
		}

		return result;
	}

	/**
	 * Reads the reasons of the current organization that are still selectable.
	 *
	 * @returns The active reasons.
	 */
	public async findActive(): Promise<OrderReturnReason[]> {
		return await this.typeOrmOrderReturnReasonRepository.find({
			where: {
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId(),
				isActive: true
			}
		});
	}

	/**
	 * @param id The reason to read.
	 * @returns The reason, when it belongs to the caller's tenant and organization.
	 * @throws NotFoundException when it does not, so one tenant can never read another's reasons.
	 */
	public async findOneScoped(id: ID): Promise<OrderReturnReason> {
		const reason = await this.typeOrmOrderReturnReasonRepository.findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		if (!reason) {
			throw new NotFoundException('The return reason was not found.');
		}

		return reason;
	}

	/**
	 * A reason tree is two levels: a reason and its variants. A variant of a variant is refused.
	 *
	 * @param parentId The proposed parent.
	 * @param organizationId The organization both rows belong to.
	 */
	private async assertRootParent(parentId: ID, organizationId: ID): Promise<void> {
		const parent = await this.typeOrmOrderReturnReasonRepository.findOne({
			where: {
				id: parentId,
				tenantId: RequestContext.currentTenantId(),
				organizationId
			}
		});

		if (!parent) {
			throw new BadRequestException('The parent return reason was not found.');
		}

		if (parent.parentId) {
			throw new BadRequestException('A return reason tree is two levels deep; a variant cannot have variants.');
		}
	}
}
