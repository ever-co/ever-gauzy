import { PartialType } from '@nestjs/swagger';
import { IResourceLinkUpdateInput } from '@gauzy/contracts';
import { CreateResourceLinkDTO } from './create-resource-link.dto';

/**
 * Create ResourceLink data validation request DTO
 */
export class UpdateResourceLinkDTO extends PartialType(CreateResourceLinkDTO) implements IResourceLinkUpdateInput {}
