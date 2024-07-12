import { Controller, Post, Req, Type } from '@nestjs/common';
import { Public } from '@gauzy/common';
import { Request } from 'express';
import { ProbotDiscovery } from './probot.discovery';

/**
 * Factory function to create a NestJS controller class for handling webhook hooks.
 * @param path The path at which the controller should listen for webhook requests.
 */
export function getControllerClass({ path }): Type<any> {
	@Public()
	@Controller()
	class HookController {
		constructor(private readonly probotDiscovery: ProbotDiscovery) { }

		/**
		 * Endpoint for receiving webhook requests.
		 * @param req The Express request object.
		 */
		@Post([path])
		async hooks(@Req() req: Request) {
			// Forward the request to ProbotDiscovery for processing.
			return await this.probotDiscovery.receiveHook(req);
		}
	}

	return HookController;
}
