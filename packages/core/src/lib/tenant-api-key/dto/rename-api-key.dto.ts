import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

/**
 * The body of `PUT /tenant-api-key`: the new label of the caller's tenant's key. The name is the only member
 * of a key that changes after issuance — the key and the secret are a pair, replaced by revoking and
 * generating again.
 */
export class RenameApiKeyDTO {
	@ApiProperty({ type: String, description: 'The new name or label for the API key.', minLength: 1, maxLength: 255 })
	@IsNotEmpty()
	@IsString()
	@Length(1, 255)
	readonly name: string;
}
