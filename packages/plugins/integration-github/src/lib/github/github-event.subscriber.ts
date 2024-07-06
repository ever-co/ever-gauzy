import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Subject } from 'rxjs';
import { filter, takeUntil, tap } from 'rxjs/operators';
import { IntegrationEnum } from '@gauzy/contracts';
import { EventBus, IntegrationDeleteEvent } from '@gauzy/core';
import { GithubInstallationDeleteCommand } from './commands';

@Injectable()
export class GithubEventSubscriber implements OnModuleInit, OnModuleDestroy {
	private readonly onDestroy$: Subject<void> = new Subject<void>();

	constructor(private readonly _eventBus: EventBus, private readonly _commandBus: CommandBus) {}

	/**
	 * Initializes the module and sets up a subscription to listen for IntegrationDeleteEvent events.
	 * The subscription filters the events to only process those related to GitHub integrations.
	 * When an event is received, a GithubInstallationDeleteCommand is executed.
	 */
	async onModuleInit() {
		this._eventBus
			.ofType(IntegrationDeleteEvent)
			.pipe(
				filter(({ integration }) => !!integration),
				filter(({ integration }) => integration.integration.provider === IntegrationEnum.GITHUB),
				tap(async ({ integration }: IntegrationDeleteEvent) => {
					const command = new GithubInstallationDeleteCommand(integration);
					await this._commandBus.execute(command);
				}),
				takeUntil(this.onDestroy$) // Unsubscribe when the component is destroyed
			)
			.subscribe();
	}

	/**
	 * This method is called when the module is destroyed.
	 * It emits a value and completes the onDestroy$ subject to ensure
	 * all subscriptions are properly unsubscribed, preventing memory leaks.
	 */
	async onModuleDestroy() {
		this.onDestroy$.next();
		this.onDestroy$.complete();
	}
}
