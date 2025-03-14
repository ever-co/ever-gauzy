import { PartialType } from '@nestjs/swagger';
import { CreatePluginDTO } from './create-plugin.dto';

export class UpdatePluginDTO extends PartialType(CreatePluginDTO) {}
