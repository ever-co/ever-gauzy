import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeleteResult, FindManyOptions } from 'typeorm';
import { ID, IPagination } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { OrderReturn } from '../order-return/order-return.entity';
import { OrderReturnLine } from '../order-return-line/order-return-line.entity';
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

		await super.update(id, entity as any);

		return await this.findOneScoped(id);
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

		await super.update(id, { isActive: false } as any);

		return await this.findOneScoped(id);
	}

	/**
	 * Removes a reason that has never explained anything.
	 *
	 * The destructive removal is refused while a return or a return line still names the reason, because
	 * the statement would otherwise **succeed and destroy the reporting key**: `order_return.reasonId`
	 * and `order_return_line.reasonId` are both `SET NULL`, so nothing in the database stops the delete —
	 * it nulls the reason on every return filed under the code and leaves a report that groups returns by
	 * reason code with a column of blanks. That is the one outcome the governed list exists to prevent,
	 * and it is why `DELETE /order-return-reasons/:id` deactivates instead of removing.
	 *
	 * The refusal is also what makes the route's own summary true rather than aspirational — the handler
	 * describes itself as removing "a reason that was never used", and until this guard existed nothing
	 * on either surface checked that it was.
	 *
	 * Retired returns count as users. A soft-deleted return can be restored, and the reason it was filed
	 * under has to still be there when it is: a guard that counted only the live rows would let the
	 * destructive route succeed and then hand `recoverOrderReturn` a return whose reason had vanished.
	 *
	 * @param id The reason to remove.
	 * @returns The delete result.
	 * @throws BadRequestException when the reason is in use, naming the counts and the act that retires
	 * it instead.
	 */
	public async delete(id: ID): Promise<DeleteResult> {
		const reason = await this.findOneScoped(id);
		const usage = await this.countUsage(reason);

		if (usage.returns || usage.lines) {
			throw new BadRequestException({
				message:
					`RETURN_REASON_IN_USE: "${reason.code}" still explains ${usage.returns} return(s) and ` +
					`${usage.lines} return line(s), so removing it would leave them unexplainable. Deactivate ` +
					'it instead, which keeps the row for every report that groups by its code.',
				code: 'RETURN_REASON_IN_USE',
				details: { reasonId: id, code: reason.code, returns: usage.returns, lines: usage.lines }
			});
		}

		return await super.delete(id);
	}

	/**
	 * How many rows still name a reason.
	 *
	 * Both columns that carry a reason are counted, because they are independent: a return is filed under
	 * the header's reason while its individual lines may carry their own, so a reason used only at line
	 * level would otherwise be removable by a guard that read the header alone.
	 *
	 * The count runs through the manager the repository already holds rather than through a second
	 * injection, and it is scoped to the reason's own tenant and organization: a count that spanned
	 * tenants would refuse a removal because some other tenant's return happens to carry the same
	 * identifier, which no identifier can, and would then be a guard firing on nothing.
	 *
	 * @param reason The reason.
	 * @returns The two counts, each including soft-deleted rows.
	 */
	private async countUsage(reason: OrderReturnReason): Promise<{ returns: number; lines: number }> {
		const scope = {
			reasonId: reason.id,
			...(reason.tenantId ? { tenantId: reason.tenantId } : {}),
			...(reason.organizationId ? { organizationId: reason.organizationId } : {})
		};
		const manager = this.typeOrmOrderReturnReasonRepository.manager;

		return {
			returns: await manager.count(OrderReturn, { where: scope, withDeleted: true }),
			lines: await manager.count(OrderReturnLine, { where: scope, withDeleted: true })
		};
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
