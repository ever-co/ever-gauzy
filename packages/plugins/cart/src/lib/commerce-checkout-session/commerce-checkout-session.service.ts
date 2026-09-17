import { Injectable } from '@nestjs/common';
import { CommerceCheckoutSessionStatus, ID, IPagination } from '@gauzy/contracts';
import { TenantAwareCrudService } from '@gauzy/core';
import { CommerceCheckoutSession } from './commerce-checkout-session.entity';
import { TypeOrmCommerceCheckoutSessionRepository } from './repository/type-orm-commerce-checkout-session.repository';
import { MikroOrmCommerceCheckoutSessionRepository } from './repository/mikro-orm-commerce-checkout-session.repository';

/** The statuses in which a checkout session still holds the cart. */
const NON_TERMINAL_STATUSES = [
	CommerceCheckoutSessionStatus.STARTED,
	CommerceCheckoutSessionStatus.IN_PROGRESS
];

/**
 * The state of an in-progress checkout.
 *
 * At most one non-terminal session exists per cart: the service refuses a second one inside the same
 * cart rather than letting two checkout attempts race for the same lines, and the migration's partial
 * unique index is the database-side expression of the same rule on the dialects that support one.
 */
@Injectable()
export class CommerceCheckoutSessionService extends TenantAwareCrudService<CommerceCheckoutSession> {
	constructor(
		readonly typeOrmCommerceCheckoutSessionRepository: TypeOrmCommerceCheckoutSessionRepository,
		readonly mikroOrmCommerceCheckoutSessionRepository: MikroOrmCommerceCheckoutSessionRepository
	) {
		super(typeOrmCommerceCheckoutSessionRepository, mikroOrmCommerceCheckoutSessionRepository);
	}

	/**
	 * Finds the session a cart is currently checking out through, if any.
	 *
	 * @param cartId The cart.
	 * @returns The open session, or null.
	 */
	public async findOpenForCart(cartId: ID): Promise<CommerceCheckoutSession | null> {
		const sessions = (await this.findAll({ where: { cartId } })) as IPagination<CommerceCheckoutSession>;

		return (
			sessions.items.find((session: CommerceCheckoutSession) =>
				NON_TERMINAL_STATUSES.includes(session.status)
			) ?? null
		);
	}

	/**
	 * Moves a cart's open session to a terminal status.
	 *
	 * @param cartId The cart.
	 * @param status The terminal status to move to.
	 * @returns The number of sessions that were closed.
	 */
	public async closeForCart(cartId: ID, status: CommerceCheckoutSessionStatus): Promise<number> {
		const sessions = (await this.findAll({ where: { cartId } })) as IPagination<CommerceCheckoutSession>;
		let closed = 0;

		for (const session of sessions.items) {
			if (!NON_TERMINAL_STATUSES.includes(session.status)) {
				continue;
			}

			await this.update(session.id, { status } as any);
			closed++;
		}

		return closed;
	}

	/**
	 * Records that a step of a session completed.
	 *
	 * `completedSteps` is append-only: a caller cannot rewrite the path it took through the checkout,
	 * which is what lets a resumed session be explained.
	 *
	 * @param sessionId The session.
	 * @param step The step key that completed.
	 * @param data The input the step accumulated.
	 * @returns The updated session.
	 */
	public async completeStep(
		sessionId: ID,
		step: string,
		data?: Record<string, unknown>
	): Promise<CommerceCheckoutSession> {
		const session = await this.findOneByIdString(sessionId);
		const completedSteps = [...(session.completedSteps ?? [])];

		if (!completedSteps.includes(step)) {
			completedSteps.push(step);
		}

		await this.update(session.id, {
			step,
			completedSteps,
			data: { ...(session.data ?? {}), ...(data ?? {}) },
			status:
				session.status === CommerceCheckoutSessionStatus.STARTED
					? CommerceCheckoutSessionStatus.IN_PROGRESS
					: session.status
		} as any);

		return this.findOneByIdString(session.id);
	}
}
