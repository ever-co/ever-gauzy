import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Subscription, tap, filter, catchError, EMPTY } from 'rxjs';
import { EventBus, AccountRegistrationEvent } from '@gauzy/core';
import { SimService } from '../sim.service';

@Injectable()
export class SimAccountRegistrationHandler implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(SimAccountRegistrationHandler.name);
	private subscription!: Subscription;

	constructor(
		private readonly eventBus: EventBus,
		private readonly simService: SimService
	) {}

	onModuleInit(): void {
		this.subscription = this.eventBus
			.ofType(AccountRegistrationEvent)
			.pipe(
				filter((event: AccountRegistrationEvent) => !!event.user),
				tap((event: AccountRegistrationEvent) => this.handleAccountRegistration(event)),
				catchError((error) => {
					this.logger.error('Error in AccountRegistrationEvent subscription', error?.message);
					return EMPTY;
				})
			)
			.subscribe();
	}

	/**
	 * Handles AccountRegistrationEvent by triggering any SIM workflow mapped to the 'account.registered' event.
	 */
	private async handleAccountRegistration(event: AccountRegistrationEvent): Promise<void> {
		try {
			const { user } = event;
			const tenantId = user?.tenantId;

			if (!tenantId) {
				return;
			}

			await this.simService.triggerEventWorkflow({
				event: 'account.registered',
				data: {
					id: user.id,
					email: user.email,
					firstName: user.firstName,
					lastName: user.lastName,
					tenantId: user.tenantId
				},
				tenantId,
				organizationId: tenantId // Use tenantId as fallback since account registration may not have an organizationId
			});
		} catch (error: any) {
			this.logger.error('Failed to handle AccountRegistrationEvent for SIM workflow trigger', {
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
