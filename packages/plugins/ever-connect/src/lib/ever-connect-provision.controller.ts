import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res, UseFilters, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '@gauzy/common';
import { EverConnectProvisionExceptionFilter } from './ever-connect-provision.filter';
import { EverConnectProvisionGuard } from './guards/ever-connect-provision.guard';
import { PROVISION_LANDING_HEADERS, PROVISION_LANDING_HTML } from './provision-landing';
import {
	EverConnectProvisionService,
	ProvisionPreflight,
	ProvisionResponse,
	ProvisionSummary
} from './services/ever-connect-provision.service';

/** Every route: 10 requests a minute per address. */
const LIMIT = { default: { limit: 10, ttl: 60_000 } };

/**
 * Creating a workspace a person asked for in Ever, under `/api/ever-connect/provision`. Public routes
 * (the person is not signed in to Gauzy yet): each is answered only with
 * `EVER_CONNECT_PROVISION_ENABLED=true` on a connected installation (404 otherwise), each verifies
 * what it is given, and each takes at most 10 requests a minute from one address. No answer is cached.
 *
 * - `GET /provision`: the landing page Ever sends the person to, with the signed request in the URL
 *   fragment (`#intent=<JWS>`), never in a query;
 * - `POST /provision/preflight {intent}`: verifies the request and answers a one-time key;
 * - `POST /provision/summary {provision_key, handoff_key}`: what the confirmation page shows;
 * - `POST /provision {provision_key, handoff_key, request}`: the person confirmed.
 */
@ApiExcludeController()
@Public()
@UseGuards(EverConnectProvisionGuard)
@UseFilters(EverConnectProvisionExceptionFilter)
@Throttle(LIMIT)
@Controller('/ever-connect/provision')
export class EverConnectProvisionController {
	constructor(private readonly provisions: EverConnectProvisionService) {}

	@Get()
	landing(@Res() res: Response): void {
		res.status(HttpStatus.OK);
		for (const [name, value] of Object.entries(PROVISION_LANDING_HEADERS)) {
			res.setHeader(name, value);
		}
		res.send(PROVISION_LANDING_HTML);
	}

	@Post('preflight')
	@HttpCode(HttpStatus.OK)
	async preflight(
		@Body() body: { intent?: unknown },
		@Res({ passthrough: true }) res: Response
	): Promise<ProvisionPreflight> {
		res.setHeader('Cache-Control', 'no-store');
		return this.provisions.preflight(body?.intent);
	}

	@Post('summary')
	@HttpCode(HttpStatus.OK)
	async summary(
		@Body() body: { provision_key?: unknown; handoff_key?: unknown },
		@Res({ passthrough: true }) res: Response
	): Promise<ProvisionSummary> {
		res.setHeader('Cache-Control', 'no-store');
		return this.provisions.summary(body?.provision_key, body?.handoff_key);
	}

	@Post()
	async create(
		@Body()
		body: {
			provision_key?: unknown;
			handoff_key?: unknown;
			request?: { first_name?: unknown; last_name?: unknown; terms?: unknown };
		},
		@Res({ passthrough: true }) res: Response
	): Promise<ProvisionResponse> {
		res.setHeader('Cache-Control', 'no-store');
		const request = body?.request && typeof body.request === 'object' ? body.request : undefined;
		const result = await this.provisions.create(body?.provision_key, body?.handoff_key, request);
		res.status(result.status === 'created' ? HttpStatus.CREATED : HttpStatus.OK);
		return result;
	}
}
