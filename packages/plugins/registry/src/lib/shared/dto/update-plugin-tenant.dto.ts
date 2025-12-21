import { PartialType } from '@nestjs/swagger';
import { CreatePluginTenantDTO } from './create-plugin-tenant.dto';

export class UpdatePluginTenantDTO extends PartialType(CreatePluginTenantDTO) {}
