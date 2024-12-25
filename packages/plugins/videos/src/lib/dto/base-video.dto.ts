import { OmitType } from '@nestjs/swagger';
import { Video } from '../entities/video.entity';

export class BaseVideoDTO extends OmitType(Video, ['id', 'file', 'createdAt', 'updatedAt', 'deletedAt'] as const) {}
