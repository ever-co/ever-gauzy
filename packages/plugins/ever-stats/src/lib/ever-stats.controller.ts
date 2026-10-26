import { BadRequestException, Body, Controller, Get, Header, HttpCode, HttpStatus, NotFoundException, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolesEnum } from '@gauzy/contracts';
import { RoleGuard, Roles } from '@gauzy/core';
import { EverStatsOperatorGuard } from './guards/ever-stats-operator.guard';
import { EverStatsLastPayload, EverStatsPreview, EverStatsService, EverStatsStatus } from './ever-stats.service';
import { SlotResult } from './ever-stats-scheduler.service';

const actorOf = (request: { user?: { id?: string } }): string | null => (request?.user?.id ? String(request.user.id) : null);

/**
 * Settings > Anonymous usage statistics, for the operator of this installation only (see
 * `EverStatsOperatorGuard`): everyone else, including the super admin of another tenant and every
 * user of Ever's cloud, gets 404, because the report aggregates every tenant. No answer is cached.
 */
@ApiTags('Anonymous usage statistics')
@Roles(RolesEnum.SUPER_ADMIN)
@UseGuards(EverStatsOperatorGuard, RoleGuard)
@Controller('/ever-stats')
export class EverStatsController {
	constructor(private readonly stats: EverStatsService) {}

	/** On or off and why, the next send, the last attempt, the key warning. */
	@Get('status')
	@Header('Cache-Control', 'no-store')
	async status(): Promise<EverStatsStatus> {
		return this.stats.status();
	}

	/** The exact bytes of the last report that was sent, its date and HTTP status (404 when none). */
	@Get('last')
	@Header('Cache-Control', 'no-store')
	async last(): Promise<EverStatsLastPayload> {
		const last = await this.stats.last();
		if (!last) {
			throw new NotFoundException();
		}
		return last;
	}

	/** "What is sent": the report as it would be built now. Nothing is stored or sent. */
	@Post('preview')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	async preview(): Promise<EverStatsPreview> {
		return this.stats.preview();
	}

	/** Switches the statistics on or off: `{ "enabled": true | false }`. */
	@Put('enabled')
	@Header('Cache-Control', 'no-store')
	async enabled(@Body() body: { enabled?: unknown }, @Req() request: { user?: { id?: string } }): Promise<EverStatsStatus> {
		if (typeof body?.enabled !== 'boolean') {
			throw new BadRequestException('enabled must be true or false');
		}
		return this.stats.setEnabled(body.enabled, actorOf(request));
	}

	/** Sends now (409 while switched off, 429 within 10 minutes of the previous one). */
	@Post('send-now')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	async sendNow(): Promise<SlotResult> {
		return this.stats.sendNow();
	}

	/** New statistics id and key: `{ "confirm": true }`. */
	@Post('reset-identity')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	async resetIdentity(@Body() body: { confirm?: unknown }, @Req() request: { user?: { id?: string } }): Promise<EverStatsStatus> {
		if (body?.confirm !== true) {
			throw new BadRequestException('confirm must be true');
		}
		return this.stats.resetIdentity(actorOf(request));
	}
}
