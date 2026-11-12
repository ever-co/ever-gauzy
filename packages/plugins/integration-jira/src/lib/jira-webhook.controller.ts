import { BadRequestException, Controller, Header, Headers, HttpCode, HttpStatus, Inject, Logger, NotFoundException, Param, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Request } from 'express';
import { isUUID } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { Public } from '@gauzy/common';
import { JiraCloudConfig, jiraWebhooksEnabled } from './jira-config';
import { JiraTenantService } from './jira-tenant.service';
import { JiraWebhookDedupeService } from './jira-webhook-dedupe.service';
import { deliveryIdOf, isDeliveryForWebhooks, issueOfDelivery, JiraWebhookPayload, verifyJiraWebhookToken } from './jira-webhook.verification';
import { JIRA_CONFIG, JIRA_ROUTE_PREFIX, JIRA_WEBHOOK_MAX_BYTES } from './jira.constants';
import { JiraSyncService } from './sync/jira-sync.service';

type RawBodyRequest = Request & { rawBody?: Buffer };

/** What a delivery was answered. */
export interface JiraWebhookAnswer {
	accepted: boolean;
	queued: boolean;
	duplicate?: boolean;
}

/**
 * `POST /integration/jira/webhook/:integrationId`: the dynamic webhook deliveries of one connection (the connection
 * registered the address with its id, see `JiraWebhookService`). Public, so everything rests on the connection named in
 * the path and on Jira's bearer token: an OAuth app's deliveries carry `Authorization: Bearer <JWT>` signed with the
 * app's client secret (`verifyJiraWebhookToken`). Nothing in the payload picks the tenant: the connection does, and a
 * delivery that came through a webhook the connection no longer holds is left alone.
 *
 * A delivery is acknowledged as soon as those checks pass; the issue it names is then read again from Jira and applied
 * behind the response, through the connection's inbound mapping of the issue's project. Each delivery is applied once:
 * Jira keeps `X-Atlassian-Webhook-Identifier` across its retries, the first one claims it, and a failed apply releases
 * it so a retry goes through (a webhook never moves the import position, and the next import reads the issue anyway).
 */
@ApiExcludeController()
@Public()
@Controller(`${JIRA_ROUTE_PREFIX}/webhook`)
export class JiraWebhookController {
	private readonly logger = new Logger(JiraWebhookController.name);

	constructor(
		@Inject(JIRA_CONFIG) private readonly config: JiraCloudConfig,
		private readonly tenants: JiraTenantService,
		private readonly sync: JiraSyncService,
		private readonly deliveries: JiraWebhookDedupeService
	) {}

	@Post('/:integrationId')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	async receive(
		@Param('integrationId') integrationId: string,
		@Req() request: RawBodyRequest,
		@Headers('authorization') authorization?: string,
		@Headers('x-atlassian-webhook-identifier') identifier?: string
	): Promise<JiraWebhookAnswer> {
		if (!jiraWebhooksEnabled(this.config) || !this.config.clientSecret) throw new UnauthorizedException('Jira webhooks are not configured on this server.');
		if (!isUUID(integrationId)) throw new NotFoundException();
		const raw = request.rawBody;
		if (!Buffer.isBuffer(raw) || raw.length === 0) throw new BadRequestException('The raw request body is required.');
		if (raw.length > JIRA_WEBHOOK_MAX_BYTES) throw new BadRequestException('The webhook body is too large.');
		const check = verifyJiraWebhookToken(this.config.clientSecret, authorization);
		// `=== false`, not `!check.valid`: the images compile plugin sources without strictNullChecks, where a negation
		// does not narrow this union and `check.reason` would not compile.
		if (check.valid === false) throw new UnauthorizedException(`Invalid or missing Jira webhook token (${check.reason}).`);
		let payload: JiraWebhookPayload;
		try {
			payload = JSON.parse(raw.toString('utf8'));
		} catch {
			throw new BadRequestException('The webhook body is not JSON.');
		}
		// A delivery is a JSON object; `null`, an array or a bare value is not one.
		if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new BadRequestException('The webhook body is not a delivery.');
		const tenant = await this.tenants.findAnyById(integrationId as ID);
		if (!tenant) throw new NotFoundException();
		// A delivery of a webhook the connection no longer holds (it was replaced): acknowledged, nothing applied.
		if (!isDeliveryForWebhooks(payload, this.tenants.webhookIdsOf(tenant))) return { accepted: true, queued: false };
		const about = issueOfDelivery(payload);
		if (!about) return { accepted: true, queued: false };

		const delivery = deliveryIdOf(identifier);
		if (delivery && !(await this.deliveries.claim(integrationId, delivery))) return { accepted: true, queued: false, duplicate: true };

		// Answered now; applied behind the response (reading the issue and writing the task may take longer than Jira waits).
		setImmediate(() => {
			this.apply(tenant.id as ID, about.issueId, about.projectId, delivery).catch((error: unknown) => {
				this.logger.warn(`Webhook issue ${about.issueId} could not be applied: ${error instanceof Error ? error.message : String(error)}`);
			});
		});
		return { accepted: true, queued: true };
	}

	private async apply(integrationId: ID, issueId: string, projectId: string | null, delivery: string | null): Promise<void> {
		let failed = true;
		try {
			// The connection as it is now (its token may have been renewed since the delivery was taken).
			const tenant = await this.tenants.findAnyById(integrationId);
			if (!tenant) {
				failed = false;
				return;
			}
			const outcome = await this.sync.applyIssueFromWebhook(tenant, issueId, projectId);
			failed = !!outcome.error;
			if (outcome.error) this.logger.warn(`Webhook issue ${issueId} of connection ${integrationId} failed: ${outcome.error}`);
		} finally {
			// Released: Jira's retry of the delivery is applied after all.
			if (failed && delivery) await this.deliveries.release(integrationId, delivery);
		}
	}
}
