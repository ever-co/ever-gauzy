import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID, IEmbedAllowedOrigin, IEmbedAllowedOriginCreateInput } from '@gauzy/contracts';
import { EmbedAllowedOrigin } from '../embed-allowed-origin.entity';

/** `POST /api/embed-allowed-origins`: the origin is normalized by the service, which refuses anything else. */
export class CreateEmbedAllowedOriginDTO implements IEmbedAllowedOriginCreateInput {
	@ApiProperty({ type: () => String, maxLength: 255, example: 'https://app.example.com' })
	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	origin: string;

	@ApiProperty({ type: () => String })
	@IsUUID()
	organizationId: ID;
}

/** An allowed origin as the list answers it: who added it and when. */
export class EmbedAllowedOriginResponseDTO implements IEmbedAllowedOrigin {
	@ApiProperty({ type: () => String })
	id: ID;

	@ApiProperty({ type: () => String })
	origin: string;

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
		answer.organizationId = row.organizationId;
		answer.createdByUserId = row.createdByUserId;
		answer.createdAt = row.createdAt;
		return answer;
	}
}
