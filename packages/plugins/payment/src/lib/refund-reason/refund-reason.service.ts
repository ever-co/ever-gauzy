import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ID, IPagination } from '@gauzy/contracts';
import { CrudService, RequestContext } from '@gauzy/core';
import { RefundReason } from './refund-reason.entity';
import { TypeOrmRefundReasonRepository } from './repository/type-orm-refund-reason.repository';
import { MikroOrmRefundReasonRepository } from './repository/mikro-orm-refund-reason.repository';
import { IRefundReason, IRefundReasonCreateInput, IRefundReasonUpdateInput } from '../payment.types';

/**
 * The governed refund reasons.
 *
 * **At most two levels.** A reason may refine another reason and nothing may refine it in turn: a
 * taxonomy that can go arbitrarily deep is a taxonomy nobody maintains, while the second level —
 * "damaged" under "item problem" — is as far as a refund conversation actually goes. The refusal is a
 * service rule rather than a table rule, because a self-referencing foreign key cannot express depth;
 * it is checked on create and again on update, where a reason could otherwise be moved under its own
 * child.
 *
 * A reason a refund cites is **deactivated, not deleted**, so the reporting that cites it keeps
 * resolving; deleting one that is still referenced is refused for the same reason.
 */
@Injectable()
export class RefundReasonService extends CrudService<RefundReason> {
	constructor(
		readonly typeOrmRefundReasonRepository: TypeOrmRefundReasonRepository,
		readonly mikroOrmRefundReasonRepository: MikroOrmRefundReasonRepository
	) {
		super(typeOrmRefundReasonRepository, mikroOrmRefundReasonRepository);
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
	 * Creates a reason, optionally under an existing one.
	 *
	 * @param input The reason to create.
	 * @returns The stored reason.
	 * @throws BadRequestException when the code or the label is missing, when the code is already
	 * used in the organization, or when the parent is itself a refinement.
	 */
	async createReason(input: IRefundReasonCreateInput): Promise<IRefundReason> {
		const code = input.code?.trim();
		const label = input.label?.trim();

		if (!code) {
			throw new BadRequestException('REFUND_REASON_CODE_REQUIRED');
		}

		if (!label) {
			throw new BadRequestException('REFUND_REASON_LABEL_REQUIRED');
		}

		const existing = await this.findByCode(code);

		if (existing) {
			throw new BadRequestException(`Refund reason '${code}' already exists in this organization.`);
		}

		if (input.parentId) {
			const parent = await this.findReasonOrFail(input.parentId);

			if (parent.parentId) {
				throw new BadRequestException('REFUND_REASON_DEPTH_EXCEEDED');
			}
		}

		return this.create({ ...input, code, label, ...this.scope } as never);
	}

	/**
	 * Updates a reason.
	 *
	 * A move is judged from both ends, because the tree is at most two levels deep: the parent must be
	 * a root, and the reason being moved must be a leaf — a reason that already refines nothing else.
	 * Handing a parent to a reason that has refinements of its own would carry all of them down to a
	 * third level, which is the shape this rule exists to refuse.
	 *
	 * @param id The reason to update.
	 * @param input The fields to change.
	 * @returns The stored reason.
	 * @throws NotFoundException when the reason is not in the caller's organization.
	 * @throws BadRequestException when the code would change, when the new parent is the reason
	 * itself or one of its children, or when the move would create a third level.
	 */
	async updateReason(id: ID, input: IRefundReasonUpdateInput): Promise<IRefundReason> {
		const reason = await this.findReasonOrFail(id);

		if (input.code && input.code.trim() !== reason.code) {
			throw new BadRequestException(`Refund reason code '${reason.code}' cannot change: reports cite it.`);
		}

		if (input.parentId) {
			if (input.parentId === id) {
				throw new BadRequestException('REFUND_REASON_CYCLE');
			}

			const parent = await this.findReasonOrFail(input.parentId);
			const children: IRefundReason[] = await this.find({ where: { parentId: id, ...this.scope } as never });

			// Either condition creates a third level. A new parent that is not itself a root — because it
			// refines something, or because it is one of this reason's own refinements — puts this reason one
			// level down; and a reason that already has refinements carries them with it, so giving it a
			// parent at all makes every one of them a third level.
			if (parent.parentId || children.length) {
				throw new BadRequestException('REFUND_REASON_DEPTH_EXCEEDED');
			}
		}

		const { code, ...changes } = input;
		void code;

		await this.update(id, { ...changes } as never);

		return this.findReasonOrFail(id);
	}

	/**
	 * Deactivates a reason that is no longer offered, keeping it for the refunds that cite it.
	 *
	 * @param id The reason to deactivate.
	 * @returns The stored reason.
	 */
	async deactivateReason(id: ID): Promise<IRefundReason> {
		await this.findReasonOrFail(id);
		await this.update(id, { isActive: false } as never);

		return this.findReasonOrFail(id);
	}

	/**
	 * Loads a reason that belongs to the caller's organization.
	 *
	 * @param id The reason to load.
	 * @returns The reason.
	 * @throws NotFoundException when it does not exist inside the caller's scope.
	 */
	async findReasonOrFail(id: ID): Promise<IRefundReason> {
		const reason = await this.findOneByWhereOptions({ id, ...this.scope } as never);

		if (!reason) {
			throw new NotFoundException('REFUND_REASON_NOT_FOUND');
		}

		return reason;
	}

	/**
	 * Resolves a reason by its code.
	 *
	 * **A free code is an answer, not a refusal.** The read is the fail-soft half of the pair —
	 * `findOneOrFailByWhereOptions`, whose `ITryRequest` carries `success: false` — because the
	 * uniqueness rule in `createReason` asks whether the code is *taken*, and a taxonomy can only be
	 * populated by an operator if the read that clears a free code answers rather than raises.
	 *
	 * @param code The stable code.
	 * @returns The reason, or null when this organization has none with that code.
	 */
	async findByCode(code: string): Promise<IRefundReason | null> {
		const outcome = await this.findOneOrFailByWhereOptions({ code: code?.trim(), ...this.scope } as never);

		return outcome.success ? (outcome.record as IRefundReason) : null;
	}

	/**
	 * Paginates the reasons of the caller's organization.
	 *
	 * @param options Optional filters, merged with the tenancy scope.
	 * @returns One page of reasons.
	 */
	async findReasons(options: Record<string, unknown> = {}): Promise<IPagination<IRefundReason>> {
		return this.findAll({ ...options, where: { ...((options.where as object) ?? {}), ...this.scope } } as never);
	}
}
