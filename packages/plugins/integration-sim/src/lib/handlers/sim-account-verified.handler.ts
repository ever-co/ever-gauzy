import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Subscription, tap, filter, catchError, EMPTY } from 'rxjs';
import { EventBus, AccountVerifiedEvent } from '@gauzy/core';
import { SimService } from '../sim.service';

@Injectable()
export class SimAccountVerifiedHandler implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(SimAccountVerifiedHandler.name);
	private subscription!: Subscription;

	constructor(
		private readonly eventBus: EventBus,
		private readonly simService: SimService
	) {}

	onModuleInit(): void {
		this.subscription = this.eventBus
			.ofType(AccountVerifiedEvent)
			.pipe(
				filter((event: AccountVerifiedEvent) => !!event.user),
				tap((event: AccountVerifiedEvent) => this.handleAccountVerified(event)),
				catchError((error) => {
					this.logger.error('Error in AccountVerifiedEvent subscription', error?.message);
					return EMPTY;
				})
			)
			.subscribe();
	}

	/**
	 * Handles AccountVerifiedEvent by triggering any SIM workflow mapped to the 'account.verified' event.
	 */
	private async handleAccountVerified(event: AccountVerifiedEvent): Promise<void> {
		try {
			const { user } = event;
			const tenantId = user?.tenantId;

			if (!tenantId) {
				return;
			}

			await this.simService.triggerEventWorkflow({
				event: 'account.verified',
				data: {
					id: user.id,
					email: user.email,
					firstName: user.firstName,
					lastName: user.lastName,
					tenantId: user.tenantId
				},
				tenantId,
				organizationId: tenantId // Use tenantId as fallback since account verification may not have an organizationId
			});
		} catch (error: any) {
			this.logger.error('Failed to handle AccountVerifiedEvent for SIM workflow trigger', {
				message: error?.message,
				stack: error?.stack
			});
		}
	}

	onModuleDestroy(): void {
		if (this.subscription) {
			this.subscription.unsubscribe();
		}
	}
}
