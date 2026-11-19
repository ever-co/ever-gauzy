import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import {
	ID,
	IEmbedAllowedOrigin,
	IEmbedAllowedOriginCreateInput,
	IEmbedAllowedOriginUpdateInput
} from '@gauzy/contracts';
import { IsOrganizationBelongsToUser } from '../../shared/validators';
import { EmbedAllowedOrigin } from '../embed-allowed-origin.entity';

/** `POST /api/embed-allowed-origins`: the origin is normalized by the service, which refuses anything else. */
export class CreateEmbedAllowedOriginDTO implements IEmbedAllowedOriginCreateInput {
	@ApiProperty({ type: () => String, maxLength: 255, example: 'https://app.example.com' })
	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	origin: string;

	/**
	 * An organization of the caller's own tenant that they may reach. The CRUD base confines no tenant admin to one
	 * organization, so without the check an admin could name another tenant's organization.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@IsOrganizationBelongsToUser()
	organizationId: ID;

	@ApiPropertyOptional({
		type: () => Boolean,
		default: false,
		description:
			"Lets the organization's people sign in from this site themselves and get their timer token without a server (POST /embed/authorize)."
	})
	@IsOptional()
	@IsBoolean()
	allowPersonSignIn?: boolean;
}

/** `PATCH /api/embed-allowed-origins/:id`: the one setting of an allowed site that changes. */
export class UpdateEmbedAllowedOriginDTO implements IEmbedAllowedOriginUpdateInput {
	@ApiProperty({
		type: () => Boolean,
		description: "Whether the organization's people can sign in from this site themselves (POST /embed/authorize)."
	})
	@IsBoolean()
	allowPersonSignIn: boolean;
}

/** An allowed origin as the list answers it: who added it and when, and whether people can sign in from it. */
export class EmbedAllowedOriginResponseDTO implements IEmbedAllowedOrigin {
	@ApiProperty({ type: () => String })
	id: ID;

	@ApiProperty({ type: () => String })
	origin: string;

	@ApiProperty({ type: () => Boolean })
	allowPersonSignIn: boolean;

	@ApiPropertyOptional({ type: () => String })
	organizationId?: ID;

	@ApiPropertyOptional({ type: () => String })
	createdByUserId?: ID;

	@ApiPropertyOptional({ type: () => Date })
	createdAt?: Date;

	static from(row: EmbedAllowedOrigin): EmbedAllowedOriginResponseDTO {
		const answer = new EmbedAllowedOriginResponseDTO();
		answer.id = row.id;
		answer.origin = row.origin;
		answer.allowPersonSignIn = row.allowPersonSignIn === true;
		answer.organizationId = row.organizationId;
		answer.createdByUserId = row.createdByUserId;
		answer.createdAt = row.createdAt;
		return answer;
	}
}
