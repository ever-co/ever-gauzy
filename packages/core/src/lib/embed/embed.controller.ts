import {
	Body,
	Controller,
	Delete,
	Get,
	Header,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Query,
	Req,
	UseGuards
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { Public } from '@gauzy/common';
import { ID, IEmbedClientReport, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { Permissions } from '../shared/decorators';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { EmbedClientReportDTO, EmbedClientReportResponseDTO } from './dto/embed-client-report.dto';
import {
	CreateEmbedCredentialDTO,
	EmbedCredentialResponseDTO,
	EmbedCredentialWithSecretResponseDTO,
	EmbedTokenExchangeResponseDTO,
	ExchangeEmbedCredentialDTO
} from './dto/embed-credential.dto';
import { EmbedCredentialService } from './embed-credential.service';
import { EMBED_EXCHANGE_THROTTLE, embedExchangeAddress } from './embed-exchange-throttle';
import { CreateEmbedAllowedOriginDTO, EmbedAllowedOriginResponseDTO } from './dto/embed-allowed-origin.dto';
import { EmbedAllowedOriginService } from './embed-allowed-origin.service';
import { EmbedEnabledGuard } from './embed.guards';
import { isEmbedEnabled } from './embed.utils';

/** An organization's embed credentials, for its administrators. */
@ApiTags('Embed')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT)
@Controller('/embed-credentials')
export class EmbedCredentialController {
	constructor(private readonly embedCredentialService: EmbedCredentialService) {}

	/** Whether this server has embeds on: the settings page asks, whatever the switch says. */
	@ApiOperation({ summary: 'Whether this server has embed credentials on' })
	@Get('/config')
	config(): { enabled: boolean } {
		return { enabled: isEmbedEnabled() };
	}

	@ApiOperation({ summary: "The organization's working embed credentials, without secrets" })
	@ApiResponse({ status: HttpStatus.OK, type: EmbedCredentialResponseDTO, isArray: true })
	@UseGuards(EmbedEnabledGuard)
	@Get('/')
	async list(@Query('organizationId', UUIDValidationPipe) organizationId: ID): Promise<EmbedCredentialResponseDTO[]> {
		return await this.embedCredentialService.listForOrganization(organizationId);
	}

	@ApiOperation({ summary: 'Create an embed credential; the answer is the only one that holds its secret' })
	@ApiResponse({ status: HttpStatus.CREATED, type: EmbedCredentialWithSecretResponseDTO })
	@UseGuards(EmbedEnabledGuard)
	@Post('/')
	@Header('Cache-Control', 'no-store')
	@UseValidationPipe({ whitelist: true })
	async create(@Body() input: CreateEmbedCredentialDTO): Promise<EmbedCredentialWithSecretResponseDTO> {
		return await this.embedCredentialService.createForOrganization(input);
	}

	@ApiOperation({ summary: "Revoke an embed credential: its tokens are refused within 30 seconds" })
	@UseGuards(EmbedEnabledGuard)
	@Delete('/:id')
	@HttpCode(HttpStatus.NO_CONTENT)
	async revoke(@Param('id', UUIDValidationPipe) id: ID): Promise<void> {
		await this.embedCredentialService.revoke(id);
	}
}

/** The sites allowed to embed an organization's timer, for its administrators. */
@ApiTags('Embed')
@UseGuards(TenantPermissionGuard, PermissionGuard, EmbedEnabledGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT)
@Controller('/embed-allowed-origins')
export class EmbedAllowedOriginController {
	constructor(private readonly embedAllowedOriginService: EmbedAllowedOriginService) {}

	@ApiOperation({ summary: "The organization's allowed origins, with who added each and when" })
	@ApiResponse({ status: HttpStatus.OK, type: EmbedAllowedOriginResponseDTO, isArray: true })
	@Get('/')
	async list(@Query('organizationId', UUIDValidationPipe) organizationId: ID): Promise<EmbedAllowedOriginResponseDTO[]> {
		return await this.embedAllowedOriginService.listForOrganization(organizationId);
	}

	@ApiOperation({ summary: 'Allow a site (scheme, host and port) to embed the timer' })
	@ApiResponse({ status: HttpStatus.CREATED, type: EmbedAllowedOriginResponseDTO })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Not an origin: a path, a wildcard or another scheme' })
	@Post('/')
	@UseValidationPipe({ whitelist: true })
	async add(@Body() input: CreateEmbedAllowedOriginDTO): Promise<EmbedAllowedOriginResponseDTO> {
		return await this.embedAllowedOriginService.addForOrganization(input);
	}

	@ApiOperation({
		summary:
			"Remove an allowed origin: the organization's new tokens refuse it at once; CORS stops answering it within a minute, unless another organization or ALLOWED_ORIGINS still allows it"
	})
	@Delete('/:id')
	@HttpCode(HttpStatus.NO_CONTENT)
	async remove(@Param('id', UUIDValidationPipe) id: ID): Promise<void> {
		await this.embedAllowedOriginService.remove(id);
	}
}

/**
 * Exchanges an embed credential for a token limited to one member and to the timer, and answers the spent time of the
 * client a credential is limited to. Public, because the credential is the proof; no validation pipe, so a malformed
 * body gets the same 401 as a revoked credential. The limit is per credential (`embed-exchange-throttle.ts`), since a
 * host's backend exchanges one credential for all its members from one address; a body without a well-formed
 * credential is limited per client address, like the sign-in routes'. The service also caps, per address, the
 * credentials it refuses, before any lookup (`embed-exchange-failures.ts`). The two routes have one such count per
 * address, on purpose: a guessed credential costs the same lookup whichever route it is sent to. Once an address is
 * capped, both routes answer it 429 for any credential this server has not accepted recently, until the minute ends.
 */
@ApiTags('Embed')
@Controller('/embed')
export class EmbedTokenController {
	constructor(private readonly embedCredentialService: EmbedCredentialService) {}

	@ApiOperation({ summary: 'Exchange an embed credential for a short-lived timer token for one member' })
	@ApiBody({ type: ExchangeEmbedCredentialDTO })
	@ApiResponse({ status: HttpStatus.OK, type: EmbedTokenExchangeResponseDTO })
	@ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'The credential does not earn a token' })
	@ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'The member cannot track time through an embed' })
	@ApiResponse({
		status: HttpStatus.TOO_MANY_REQUESTS,
		description: 'Too many exchanges, or too many refused credentials from this address'
	})
	@Public()
	@UseGuards(EmbedEnabledGuard)
	@Throttle(EMBED_EXCHANGE_THROTTLE)
	@Post('/token')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@Header('Pragma', 'no-cache')
	async exchange(
		@Body() input: ExchangeEmbedCredentialDTO,
		@Req() request: Record<string, any>
	): Promise<EmbedTokenExchangeResponseDTO> {
		const address = embedExchangeAddress(request);
		return await this.embedCredentialService.exchange(input, address);
	}

	@ApiOperation({ summary: "The spent time of a credential's client: today, this week, by project" })
	@ApiBody({ type: EmbedClientReportDTO })
	@ApiResponse({ status: HttpStatus.OK, type: EmbedClientReportResponseDTO })
	@ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'The credential is unknown, malformed or revoked' })
	@ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'The credential has no client, or a deleted one' })
	@ApiResponse({
		status: HttpStatus.TOO_MANY_REQUESTS,
		description: 'Too many reports, or too many refused credentials from this address'
	})
	@Public()
	@UseGuards(EmbedEnabledGuard)
	@Throttle(EMBED_EXCHANGE_THROTTLE)
	@Post('/client-report')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@Header('Pragma', 'no-cache')
	async clientReport(@Body() input: EmbedClientReportDTO, @Req() request: Request): Promise<IEmbedClientReport> {
		const address = embedExchangeAddress(request);
		return await this.embedCredentialService.clientReport(input, address);
	}
}
