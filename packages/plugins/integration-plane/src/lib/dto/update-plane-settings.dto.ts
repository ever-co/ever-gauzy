import { PartialType } from '@nestjs/swagger';
import { ConfigurePlaneIntegrationDto } from './configure-plane-integration.dto';

/**
 * DTO for updating Plane integration settings.
 * All fields are optional (partial update).
 */
export class UpdatePlaneSettingsDto extends PartialType(ConfigurePlaneIntegrationDto) {}
