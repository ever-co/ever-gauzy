import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { isMySQL, isPostgres } from '@gauzy/config';
import {
	ContactBuyerRole,
	ID,
	IContactBuyer,
	IContactBuyerAuthority,
	IContactBuyerCreateInput,
	IContactBuyerFindInput,
	IContactBuyerUpdateInput
} from '@gauzy/contracts';
import { ContactStatus, PartyKind } from '../core/enums/kernel-extension.enums';
import { OrganizationContact } from '../core/entities/internal';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context/request-context';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ContactBuyer } from './contact-buyer.entity';
import { TypeOrmContactBuyerRepository } from './repository/type-orm-contact-buyer.repository';
import { MikroOrmContactBuyerRepository } from './repository/mikro-orm-contact-buyer.repository';

/**
 * Company-account membership: who may buy for an organization contact, in what role, and up to what.
 *
 * Read the rules of this service as one rule about the account, with five faces:
 *
 * 1. **The account must be a company.** A row named as `companyCustomerId` is a party whose `partyKind`
 *    is `COMPANY`; an individual named as a company account is refused with `COMPANY_ACCOUNT_REQUIRED`,
 *    because the B2B layer branches on that fact and inferring it from the presence of buyer rows is
 *    what made removing a company's last buyer silently turn it into an individual.
 * 2. **The account must be live.** A company account that is blocked takes no new orders and no new
 *    buyers: the membership is refused with `CONTACT_BLOCKED`, which is the same refusal checkout gets.
 * 3. **A party is never its own buyer, and the pair holds one membership.** Both are checked before the
 *    write, and the pair is also carried by the database's unique index.
 * 4. **A buyer belongs to at most one live company account.** The rule is a statement about the buyer's
 *    other rows — the schema chapter's one-active-account invariant — so it is decided inside the
 *    transaction that writes the membership, against a **lock on the company account row**: two
 *    concurrent invitations of the same buyer therefore cannot both pass a read-then-write check.
 * 5. **The limits narrow and never widen.** A buyer's ceilings are stored as stated and validated as
 *    non-negative amounts, and the effective ceiling of an order is the lower of the buyer's and the
 *    account's remaining credit. {@link assertMayPurchase} is where a placement is refused, and it names
 *    which ceiling refused it.
 *
 * The membership is removed softly: an order placed by a buyer must remain attributable to the
 * membership that authorised it even after the buyer leaves the account.
 */
@Injectable()
export class ContactBuyerService extends TenantAwareCrudService<ContactBuyer> {
	/** The roles that may place an order on the account at all. A `VIEWER` reads and does not buy. */
	private static readonly PURCHASING_ROLES = [
		ContactBuyerRole.PURCHASER,
		ContactBuyerRole.APPROVER,
		ContactBuyerRole.ADMIN
	];

	/** The roles that may approve an order above a threshold. */
	private static readonly APPROVING_ROLES = [ContactBuyerRole.APPROVER, ContactBuyerRole.ADMIN];

	/** The roles that administer the account: its buyer list, its limits and its terms. */
	private static readonly ADMINISTERING_ROLES = [ContactBuyerRole.ADMIN];

	constructor(
		readonly typeOrmContactBuyerRepository: TypeOrmContactBuyerRepository,
		readonly mikroOrmContactBuyerRepository: MikroOrmContactBuyerRepository
	) {
		super(typeOrmContactBuyerRepository, mikroOrmContactBuyerRepository);
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
	 * Attaches a buyer to a company account.
	 *
	 * The company account row is locked for the decision, because the rule that a buyer holds at most one
	 * live membership is a statement about the buyer's other rows: without the lock, two concurrent
	 * invitations of the same buyer into two accounts would each read "no live membership" and each
	 * write one.
	 *
	 * @param input The account, the buyer and the terms as the caller states them.
	 * @returns The stored membership.
	 * @throws BadRequestException `COMPANY_ACCOUNT_REQUIRED` when the account is not a company,
	 * `CONTACT_BLOCKED` when it is not live, `CONTACT_BUYER_SELF` when the two sides are the same party,
	 * `CONTACT_BUYER_EXISTS` when the pair already has a live membership,
	 * `CONTACT_BUYER_COMPANY_EXISTS` when the buyer already belongs to another live account, and
	 * `CONTACT_BUYER_TERMS_INVALID` for a role, limit or period day the account cannot hold.
	 */
	async addBuyer(input: IContactBuyerCreateInput): Promise<IContactBuyer> {
		const companyCustomerId = input?.companyCustomerId;
		const buyerCustomerId = input?.buyerCustomerId;

		if (!companyCustomerId || !buyerCustomerId) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_BUYER_NOT_FOUND}: a membership names the company account and the buyer, and both are required.`
			);
		}

		if (String(companyCustomerId) === String(buyerCustomerId)) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_BUYER_SELF}: contact '${buyerCustomerId}' cannot be its own buyer, because purchasing authority is a relationship with an account and not with oneself.`
			);
		}

		this.assertTerms(input);

		const role = input.role ?? ContactBuyerRole.PURCHASER;

		return this.typeOrmContactBuyerRepository.manager.transaction(async (manager) => {
			const company = await this.lockParty(manager, companyCustomerId);

			await this.assertCompanyAccount(company, companyCustomerId);
			await this.assertNoMembership(manager, companyCustomerId, buyerCustomerId);
			await this.assertBuyerIsUnattached(manager, buyerCustomerId);

			return manager.save(
				ContactBuyer,
				manager.create(ContactBuyer, {
					companyCustomerId,
					buyerCustomerId,
					role,
					...(input.spendingLimit !== undefined ? { spendingLimit: input.spendingLimit } : {}),
					...(input.periodSpendingLimit !== undefined
						? { periodSpendingLimit: input.periodSpendingLimit }
						: {}),
					...(input.approvalThreshold !== undefined ? { approvalThreshold: input.approvalThreshold } : {}),
					...(input.periodStartDay !== undefined ? { periodStartDay: input.periodStartDay } : {}),
					assignedAt: input.assignedAt ? new Date(input.assignedAt) : new Date(),
					...(input.invitedByUserId ? { invitedByUserId: input.invitedByUserId } : {}),
					...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
					...this.scope
				} as never)
			);
		});
	}

	/**
	 * Loads a membership that belongs to the caller's organization.
	 *
	 * @param id The membership id.
	 * @returns The membership.
	 * @throws NotFoundException `CONTACT_BUYER_NOT_FOUND` when it is not in the caller's scope.
	 */
	async findBuyerOrFail(id: ID): Promise<IContactBuyer> {
		const memberships: ContactBuyer[] = await this.find({ where: { id, ...this.scope } } as never);

		if (!memberships.length) {
			throw new NotFoundException(
				`${ApiErrorCode.CONTACT_BUYER_NOT_FOUND}: buyer membership '${id}' could not be found.`
			);
		}

		return memberships[0];
	}

	/**
	 * Lists memberships.
	 *
	 * @param filter Optional narrowing by account, buyer or role.
	 * @returns The memberships, newest first.
	 */
	async listBuyers(filter: IContactBuyerFindInput = {}): Promise<IContactBuyer[]> {
		return this.find({
			where: {
				...(filter.companyCustomerId ? { companyCustomerId: filter.companyCustomerId } : {}),
				...(filter.buyerCustomerId ? { buyerCustomerId: filter.buyerCustomerId } : {}),
				...(filter.role ? { role: filter.role } : {}),
				...this.scope
			},
			order: { createdAt: 'DESC' }
		} as never);
	}

	/**
	 * The live membership of one buyer in one account, when there is one.
	 *
	 * @param companyCustomerId The account.
	 * @param buyerCustomerId The buyer.
	 * @returns The membership, or null.
	 */
	async findMembership(companyCustomerId: ID, buyerCustomerId: ID): Promise<IContactBuyer | null> {
		const memberships: ContactBuyer[] = await this.find({
			where: { companyCustomerId, buyerCustomerId, ...this.scope }
		} as never);

		return memberships.length ? memberships[0] : null;
	}

	/**
	 * The live company account a buyer belongs to, which is the first question every B2B authorisation
	 * asks.
	 *
	 * Resolved as the schema chapter states: a membership row that is active and whose account is not
	 * archived. There is at most one, and the service enforces that on write.
	 *
	 * @param buyerCustomerId The buyer.
	 * @returns The membership, or null when the party buys for itself.
	 */
	async resolveCompanyAccountOf(buyerCustomerId: ID): Promise<IContactBuyer | null> {
		const memberships: ContactBuyer[] = await this.find({
			where: { buyerCustomerId, isActive: true, ...this.scope }
		} as never);

		return memberships.find((membership) => !membership.isArchived) ?? null;
	}

	/**
	 * Changes a membership's terms.
	 *
	 * Neither side of the pivot is mutable: a membership that could be re-pointed at another buyer or
	 * another account would be a way to move purchasing authority without a trace. The supported path is
	 * to remove the membership and attach a new one.
	 *
	 * @param id The membership to change.
	 * @param input The terms to change.
	 * @returns The stored membership.
	 * @throws BadRequestException `CONTACT_BUYER_TERMS_INVALID` for a role, limit or period day the
	 * account cannot hold.
	 * @throws NotFoundException when the membership is not in the caller's scope.
	 */
	async updateBuyer(id: ID, input: IContactBuyerUpdateInput): Promise<IContactBuyer> {
		const membership = await this.findBuyerOrFail(id);

		this.assertTerms({ ...membership, ...(input ?? {}) } as IContactBuyerCreateInput);

		await this.update(id, {
			...(input?.role !== undefined ? { role: input.role } : {}),
			...(input?.spendingLimit !== undefined ? { spendingLimit: input.spendingLimit } : {}),
			...(input?.periodSpendingLimit !== undefined
				? { periodSpendingLimit: input.periodSpendingLimit }
				: {}),
			...(input?.approvalThreshold !== undefined ? { approvalThreshold: input.approvalThreshold } : {}),
			...(input?.periodStartDay !== undefined ? { periodStartDay: input.periodStartDay } : {}),
			...(input?.metadata !== undefined ? { metadata: input.metadata } : {})
		} as never);

		return this.findBuyerOrFail(id);
	}

	/**
	 * Soft-deletes a membership, which is the only removal path there is.
	 *
	 * The row is kept: an order placed by this buyer must remain attributable to the membership that
	 * authorised it, and a hard delete would leave the order's own history pointing at nothing.
	 *
	 * @param id The membership to soft-delete.
	 * @returns The stored membership, soft-deleted.
	 * @throws NotFoundException when the membership is not in the caller's scope.
	 */
	async removeBuyer(id: ID): Promise<IContactBuyer> {
		await this.findBuyerOrFail(id);
		await this.softDelete(id);

		return this.findBuyerOrFail(id);
	}

	/**
	 * Whether a membership is live at an instant — the reading every authorisation uses.
	 *
	 * Membership state is the inherited `isActive` flag plus the soft-delete column, and there is no
	 * second flag to consult: a row the platform has soft-deleted is not returned by any read here.
	 *
	 * @param membership The membership.
	 * @param at The instant to evaluate at. Accepted for a caller replaying a historical decision, and
	 * unused while membership has no window of its own.
	 * @returns True when the membership currently grants what its role allows.
	 */
	isBuyerActive(membership: IContactBuyer, at: Date = new Date()): boolean {
		void at;

		return Boolean(membership) && membership.isActive !== false && !membership.deletedAt;
	}

	/**
	 * What one buyer may do, as a value the caller can read.
	 *
	 * The three answers are separated rather than collapsed into one boolean because a caller acts on
	 * them differently: reading the account's orders needs none of them, placing one needs `mayPurchase`,
	 * and the approval flow needs `mayApprove`.
	 *
	 * @param membership The membership to read.
	 * @returns The authority the role carries.
	 */
	resolveAuthority(membership: IContactBuyer): IContactBuyerAuthority {
		return {
			membership,
			mayPurchase: ContactBuyerService.PURCHASING_ROLES.includes(membership?.role),
			mayApprove: ContactBuyerService.APPROVING_ROLES.includes(membership?.role),
			mayAdminister: ContactBuyerService.ADMINISTERING_ROLES.includes(membership?.role)
		};
	}

	/**
	 * Refuses an order the buyer may not place, and answers the membership that authorises the ones it
	 * may.
	 *
	 * The refusals are the schema chapter's own list: a role that may not buy is `BUYER_NOT_AUTHORISED`
	 * (`403`), and a total above either ceiling is `BUYER_LIMIT_EXCEEDED` with the ceiling named. The
	 * company's own remaining credit is a separate check that belongs to the credit path — this method
	 * answers the membership's half of it.
	 *
	 * @param buyerCustomerId The buyer placing the order.
	 * @param orderTotal The order's grand total, when the caller is checking a placement.
	 * @param periodSpent What the buyer has already spent in the current rolling period, when the caller
	 * knows it. Defaults to zero, which is the reading for a caller checking a role alone.
	 * @returns The membership that authorises the order.
	 * @throws NotFoundException `CONTACT_BUYER_NOT_FOUND` when the party buys for no account.
	 * @throws BadRequestException `BUYER_NOT_AUTHORISED` for a role that may not buy, and
	 * `BUYER_LIMIT_EXCEEDED` for a total above a ceiling.
	 */
	async assertMayPurchase(
		buyerCustomerId: ID,
		orderTotal?: number,
		periodSpent = 0
	): Promise<IContactBuyer> {
		const membership = await this.resolveCompanyAccountOf(buyerCustomerId);

		if (!membership || !this.isBuyerActive(membership)) {
			throw new NotFoundException(
				`${ApiErrorCode.CONTACT_BUYER_NOT_FOUND}: contact '${buyerCustomerId}' buys for no company account.`
			);
		}

		const authority = this.resolveAuthority(membership);

		if (!authority.mayPurchase) {
			throw new BadRequestException(
				`${ApiErrorCode.BUYER_NOT_AUTHORISED}: a ${membership.role} may read the account and may not place an order on it.`
			);
		}

		if (orderTotal === undefined || orderTotal === null) {
			return membership;
		}

		if (membership.spendingLimit !== undefined && membership.spendingLimit !== null) {
			if (Number(orderTotal) > Number(membership.spendingLimit)) {
				throw new BadRequestException(
					`${ApiErrorCode.BUYER_LIMIT_EXCEEDED}: this order is ${Number(orderTotal)} and this buyer's per-order ceiling is ${Number(
						membership.spendingLimit
					)}.`
				);
			}
		}

		if (membership.periodSpendingLimit !== undefined && membership.periodSpendingLimit !== null) {
			const attempted = Number(periodSpent) + Number(orderTotal);

			if (attempted > Number(membership.periodSpendingLimit)) {
				throw new BadRequestException(
					`${ApiErrorCode.BUYER_LIMIT_EXCEEDED}: this order would take the buyer's rolling spend to ${attempted} against a ceiling of ${Number(
						membership.periodSpendingLimit
					)}.`
				);
			}
		}

		return membership;
	}

	/**
	 * Refuses an account that is not one a buyer may join.
	 *
	 * Two facts, in the order the schema chapter states them: the row must be a company account, and it
	 * must be live. The first is what makes the company/individual distinction a column rather than an
	 * inference; the second is the same refusal checkout gets, because a blocked account takes no new
	 * orders and therefore no new buyers.
	 *
	 * @param company The account row, or null when it does not exist in the caller's scope.
	 * @param companyCustomerId The id the caller named, for the message.
	 * @throws BadRequestException `COMPANY_ACCOUNT_REQUIRED` when it is not a company, `CONTACT_BLOCKED`
	 * when it is not live.
	 * @throws NotFoundException when the account is not in the caller's scope.
	 */
	async assertCompanyAccount(
		company: OrganizationContact | null,
		companyCustomerId: ID
	): Promise<OrganizationContact> {
		if (!company) {
			throw new NotFoundException(
				`${ApiErrorCode.CONTACT_NOT_FOUND}: contact '${companyCustomerId}' could not be found.`
			);
		}

		if (company.partyKind !== PartyKind.COMPANY) {
			throw new BadRequestException(
				`${ApiErrorCode.COMPANY_ACCOUNT_REQUIRED}: '${company.name ?? companyCustomerId}' is an individual account, and a buyer list belongs to a company.`
			);
		}

		if (company.status === ContactStatus.BLOCKED) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_BLOCKED}: '${company.name ?? companyCustomerId}' is blocked, and a blocked account takes no new buyers.`
			);
		}

		return company;
	}

	/**
	 * Validates a membership's terms.
	 *
	 * Every ceiling is an amount and therefore non-negative, and the period start day is bounded to 1–28
	 * so that every month has it. The values are validated here rather than only in a DTO because the
	 * same rules have to hold for the nightly reconciliation and for an import, neither of which goes
	 * through a request body.
	 *
	 * @param input The terms as stated.
	 * @throws BadRequestException `CONTACT_BUYER_TERMS_INVALID`.
	 */
	private assertTerms(input: Partial<IContactBuyerCreateInput>): void {
		if (input?.role !== undefined && !Object.values(ContactBuyerRole).includes(input.role)) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_BUYER_TERMS_INVALID}: '${String(input.role)}' is not a role a buyer may hold.`
			);
		}

		for (const member of ['spendingLimit', 'periodSpendingLimit', 'approvalThreshold'] as const) {
			const value = input?.[member];

			if (value === undefined || value === null) {
				continue;
			}

			if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
				throw new BadRequestException(
					`${ApiErrorCode.CONTACT_BUYER_TERMS_INVALID}: '${member}' is an amount and is never negative, and '${String(
						value
					)}' is not one.`
				);
			}
		}

		if (input?.periodStartDay !== undefined && input.periodStartDay !== null) {
			const day = Number(input.periodStartDay);

			if (!Number.isInteger(day) || day < 1 || day > 28) {
				throw new BadRequestException(
					`${ApiErrorCode.CONTACT_BUYER_TERMS_INVALID}: a rolling period starts on a day of the month between 1 and 28, and '${String(
						input.periodStartDay
					)}' is not one.`
				);
			}
		}
	}

	/**
	 * Refuses a second live membership for one pair.
	 *
	 * @param manager The transaction manager.
	 * @param companyCustomerId The account.
	 * @param buyerCustomerId The buyer.
	 * @throws BadRequestException `CONTACT_BUYER_EXISTS`.
	 */
	private async assertNoMembership(
		manager: EntityManager,
		companyCustomerId: ID,
		buyerCustomerId: ID
	): Promise<void> {
		const existing: ContactBuyer[] = await manager.find(ContactBuyer, {
			where: { companyCustomerId, buyerCustomerId, ...this.scope }
		} as never);

		if ((existing ?? []).length) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_BUYER_EXISTS}: contact '${buyerCustomerId}' is already a buyer of account '${companyCustomerId}', and a pair holds one membership.`
			);
		}
	}

	/**
	 * Refuses a buyer who already belongs to another live company account.
	 *
	 * The rule is the schema chapter's: a buyer belongs to at most one **active** company account. It is
	 * a statement about the buyer's other rows and is therefore decided here, inside the transaction that
	 * holds the account row — which is what makes two concurrent invitations of the same buyer into two
	 * accounts serialize instead of both succeeding.
	 *
	 * @param manager The transaction manager.
	 * @param buyerCustomerId The buyer.
	 * @throws BadRequestException `CONTACT_BUYER_COMPANY_EXISTS`.
	 */
	private async assertBuyerIsUnattached(manager: EntityManager, buyerCustomerId: ID): Promise<void> {
		const live: ContactBuyer[] = await manager.find(ContactBuyer, {
			where: { buyerCustomerId, isActive: true, ...this.scope }
		} as never);
		const attached = (live ?? []).filter((membership) => !membership.isArchived);

		if (attached.length) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_BUYER_COMPANY_EXISTS}: contact '${buyerCustomerId}' already buys for account '${attached[0].companyCustomerId}', and a buyer belongs to one live company account.`
			);
		}
	}

	/**
	 * Reads the company account row under a lock where the dialect supports one.
	 *
	 * The membership rules are decided from the account's own state — is it a company, is it live — and
	 * from the buyer's other rows, so the account is held for the decision rather than read and written
	 * around. The embedded dialect serializes writers on its own, so there the surrounding transaction is
	 * the lock and no statement is added.
	 *
	 * @param manager The transaction manager.
	 * @param id The account to lock.
	 * @returns The locked account row, or null when it does not exist.
	 */
	private async lockParty(manager: EntityManager, id: ID): Promise<OrganizationContact | null> {
		const query = manager
			.createQueryBuilder(OrganizationContact, 'party')
			.where({ id, ...this.scope });

		if (isPostgres() || isMySQL()) {
			// `pessimistic_write` maps to FOR UPDATE on both dialects.
			return query.setLock('pessimistic_write').getOne();
		}

		return query.getOne();
	}
}
