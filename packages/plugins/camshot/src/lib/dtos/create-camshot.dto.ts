import { OmitType } from '@nestjs/swagger';
import { Camshot } from '../entity/camshot.entity';

export class CreateCamshotDTO extends OmitType(Camshot,
	['id', 'fileKey', 'thumbKey', 'title', 'createdAt', 'updatedAt', 'deletedAt'] as const) { }
