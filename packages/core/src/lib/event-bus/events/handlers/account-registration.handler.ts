import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subscription, tap } from 'rxjs';
import { EventBus } from '../../event-bus';
import { AccountRegistrationEvent } from '../account-registration.event';

@Injectable()
export class AccountRegistrationHandler implements OnModuleInit, OnModuleDestroy {
	private subscription: Subscription;

	constructor(private readonly eventBus: EventBus) {}

	onModuleInit() {
		const event$ = this.eventBus.ofType(AccountRegistrationEvent);
		this.subscription = event$.pipe(tap((event: AccountRegistrationEvent) => this.execute(event))).subscribe();
	}

	/**
	 * Handles the account registration event.
	 * @param event The event containing the registration details.
	 */
	public async execute(event: AccountRegistrationEvent): Promise<void> {
		try {
			// Perform any necessary actions with the event data
			const { ctx, user } = event;

			// Log the successful handling of the event
			console.log(`Account Registered Successfully: ${user.name} : ${ctx.id}`);
		} catch (error) {
			// Handle any errors that occur during event handling
			console.error('Error handling during account registered event:', error);
		}
	}

	onModuleDestroy() {
		if (this.subscription) {
			this.subscription.unsubscribe();
		}
	}
}
