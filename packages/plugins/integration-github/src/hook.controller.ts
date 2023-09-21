import { Controller, Post, Req, Type } from '@nestjs/common';
import { Public } from '@gauzy/common';
import { Request } from 'express';
import { ProbotDiscovery } from './probot.discovery';

export function getControllerClass({ path }): Type<any> {
	@Public()
	@Controller()
	class HookController {
		constructor(private readonly probotDiscovery: ProbotDiscovery) { }

		@Post([path])
		async hooks(@Req() req: Request) {
			return await this.probotDiscovery.receiveHook(req);
		}
	}

	return HookController;
}
