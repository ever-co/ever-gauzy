import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID, IEmbedAuthorizeInput, IEmbedSiteTokens } from '@gauzy/contracts';
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
