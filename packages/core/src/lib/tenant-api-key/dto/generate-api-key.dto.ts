import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ID, IGenerateApiKey } from '@gauzy/contracts';
import { IsTenantBelongsToUser } from '../../shared/validators/is-tenant-belongs-to-user.decorator';

/**
 * DTO for generating a new API key for a tenant.
 */
export class GenerateApiKeyDTO implements IGenerateApiKey {
    /**
     * The unique identifier of the tenant for which the API key is being generated.
     */
    @ApiPropertyOptional({
        type: String,
        description: 'The unique identifier of the tenant.',
        format: 'uuid'
    })
    @IsOptional()
    @IsUUID()
    @IsTenantBelongsToUser()
    tenantId: ID;

    /**
     * The name or label for the API key.
     */
    @ApiPropertyOptional({
        type: String,
        description: 'The name or label for the API key.'
    })
    @IsOptional()
    @IsString()
    name: string;
}
