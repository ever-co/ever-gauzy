import { Public } from '@gauzy/common';
import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { OctokitService } from './octokit.service';

// TODO:
// For now API route is public
// We have to make a guard that validate webhook secret from payload
@Controller()
@Public()
export class OctokitController {
	constructor(private readonly _octokitService: OctokitService) {}

	@Get()
	async testGet() {
		return { hello: 'world' };
	}

	@Post()
	async webhook(@Req() request: Request, @Body() body: any) {
		// body contains whole payload that webhook send on different event
		console.log(body);

		const event = request.headers['x-github-event'];
		const action = body.action;

		// Based on event & action we can decide further processing

		if (event === 'issues' && action === 'opened') {
			// TODO
		}
		if (event === 'issues' && action === 'edited') {
			// TODO
		}
		// ...
	}
}
