import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID, IEmbedAuthorizeInput, IEmbedRenewalInput, IEmbedSiteGrant, IEmbedSiteTokens } from '@gauzy/contracts';
import { EmbedSiteGrant } from '../embed-site-grant.entity';
import { EmbedTokenExchangeResponseDTO } from './embed-credential.dto';

/**
 * `POST /api/embed/authorize`: the organization is checked by the service, which answers 403 to anyone who is not an
 * active member of it who may track time, and the origin is normalized by the service, which answers 403 to a site the
 * organization does not let people sign in from.
 */
export class AuthorizeEmbedSiteDTO implements IEmbedAuthorizeInput {
	@ApiProperty({ type: () => String })
	@IsUUID()
	organizationId: ID;

	@ApiProperty({
		type: () => String,
		maxLength: 255,
		description: "The site's origin, as its page's Origin header names it.",
		example: 'https://app.example.com'
	})
	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	origin: string;
}

/**
 * `POST /api/embed/renew`
 *
 * Carries no validators, and the route runs no validation pipe: a malformed renewal token gets the same 401 as a
 * revoked one (see `EmbedSiteGrantService.renew`).
 */
export class RenewEmbedSiteDTO implements IEmbedRenewalInput {
	@ApiProperty({ type: () => String, description: 'The renewal token the last answer gave the site (gzr_...).' })
	renewalToken: string;
}

/** What a site gets when a person allows it, and at each renewal: the only answer that holds the renewal token. */
export class EmbedSiteTokensResponseDTO extends EmbedTokenExchangeResponseDTO implements IEmbedSiteTokens {
	@ApiProperty({
		type: () => String,
		description: 'Gets the next pair from the same site, once (POST /embed/renew). It is not shown again.'
	})
	renewalToken: string;

	@ApiProperty({ type: () => String, description: 'When the renewal token stops working (ISO date).' })
	renewalExpiresAt: string;
}

/** `GET /api/embed/grants`: the person's own grants, or an organization's for an administrator. */
export class EmbedSiteGrantsQueryDTO {
	@ApiPropertyOptional({
		type: () => String,
		description:
			"An organization whose members' grants an administrator lists (ALL_ORG_EDIT); without it, your own."
	})
	@IsOptional()
	@IsUUID()
	organizationId?: ID;
}

/** A site grant as the lists answer it: built field by field, so no digest of a token ever reaches a response. */
export class EmbedSiteGrantResponseDTO implements IEmbedSiteGrant {
	@ApiProperty({
		type: () => String,
		description: 'The same through its renewals: what DELETE /embed/grants/:id takes.'
	})
	id: ID;

	@ApiProperty({ type: () => String })
	origin: string;

	@ApiProperty({ type: () => String })
	organizationId: ID;

	@ApiProperty({ type: () => String })
	userId: ID;

	@ApiProperty({ type: () => String })
	employeeId: ID;

	@ApiProperty({ type: () => Date, description: 'When the site got its current renewal token.' })
	renewedAt: Date;

	@ApiProperty({ type: () => Date, description: 'When it ends, unless the site renews it before.' })
	expiresAt: Date;

	static from(row: EmbedSiteGrant): EmbedSiteGrantResponseDTO {
		const answer = new EmbedSiteGrantResponseDTO();
		answer.id = row.familyId;
		answer.origin = row.origin;
		answer.organizationId = row.organizationId;
		answer.userId = row.userId;
		answer.employeeId = row.employeeId;
		answer.renewedAt = row.createdAt;
		answer.expiresAt = row.expiresAt;
		return answer;
	}
}
