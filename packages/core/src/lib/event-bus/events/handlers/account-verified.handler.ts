import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subscription, tap } from 'rxjs';
import { EventBus } from '../../event-bus';
import { AccountVerifiedEvent } from '../account-verified.event';

@Injectable()
export class AccountVerifiedHandler implements OnModuleInit, OnModuleDestroy {
	private subscription: Subscription;

	constructor(private readonly eventBus: EventBus) {}

	onModuleInit() {
		const event$ = this.eventBus.ofType(AccountVerifiedEvent);
		this.subscription = event$.pipe(tap((event: AccountVerifiedEvent) => this.execute(event))).subscribe();
	}

	/**
	 * Handles the account verification event.
	 * @param event The event containing the verification details.
	 */
	public async execute(event: AccountVerifiedEvent): Promise<void> {
		try {
			// Perform any necessary actions with the event data
			const { ctx, user } = event;

			// Log the successful handling of the event
			console.log(`Account Verified Successfully: ${user.name} : ${ctx.id}`);
		} catch (error) {
			// Handle any errors that occur during event handling
			console.error('Error handling during account verified event:', error);
		}
	}

	onModuleDestroy() {
		if (this.subscription) {
			this.subscription.unsubscribe();
		}
	}
}
