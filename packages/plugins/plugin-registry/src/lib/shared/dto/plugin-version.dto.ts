import { PluginVersion } from '../../domain/entities/plugin-version.entity';
import { OmitType } from '@nestjs/swagger';

export class PluginVersionDTO extends OmitType(PluginVersion, ['id', 'createdAt', 'updatedAt', 'deletedAt'] as const) {}
