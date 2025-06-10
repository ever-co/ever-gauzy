import { OmitType } from '@nestjs/swagger';
import { Soundshot } from '../entity/soundshot.entity';

export class CreateSoundshotDTO extends OmitType(Soundshot,
	['id', 'fileKey', 'title', 'createdAt', 'updatedAt', 'deletedAt'] as const) { }
