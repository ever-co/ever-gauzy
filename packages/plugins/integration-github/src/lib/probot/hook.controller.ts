import { Controller, HttpCode, HttpStatus, Post, Req, Type } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '@gauzy/common';
import { Request } from 'express';
import { IGithubWebhookRequest, ProbotDiscovery } from './probot.discovery';

/**
 * Factory function to create a NestJS controller class for handling webhook hooks.
 * @param path The path at which the controller should listen for webhook requests.
 */
export function getControllerClass({ path }): Type<any> {
	@Public()
	@ApiExcludeController()
	@Controller()
	class HookController {
		constructor(private readonly probotDiscovery: ProbotDiscovery) {}

		/**
		 * Endpoint for receiving webhook requests.
		 *
		 * Unauthenticated by design — GitHub has no bearer token to present — so authenticity comes
		 * entirely from the `x-hub-signature-256` HMAC that {@link ProbotDiscovery.receiveHook}
		 * verifies. Its `ForbiddenException` is deliberately NOT caught: a receiver that answers 2xx
		 * to a forged or unverifiable delivery is indistinguishable from one that works, and GitHub's
		 * Recent Deliveries view is where an operator finds out the secret is wrong.
		 *
		 * @param req The Express request object.
		 */
		@Post([path])
		@HttpCode(HttpStatus.OK)
		async hooks(@Req() req: Request) {
			// Forward the request to ProbotDiscovery for verification and processing.
			await this.probotDiscovery.receiveHook(req as unknown as IGithubWebhookRequest);
			return { received: true };
		}
	}

	return HookController;
}
