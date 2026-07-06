import { PartialType } from '@nestjs/swagger';
import { IAiProviderCredentialUpdateInput } from '@gauzy/contracts';
import { CreateAiProviderCredentialDTO } from './create-ai-provider-credential.dto';

/**
 * DTO for updating an existing BYOK AI provider credential.
 * All fields are optional; an omitted `apiKey` keeps the stored (encrypted) key.
 */
export class UpdateAiProviderCredentialDTO
	extends PartialType(CreateAiProviderCredentialDTO)
	implements IAiProviderCredentialUpdateInput {}
