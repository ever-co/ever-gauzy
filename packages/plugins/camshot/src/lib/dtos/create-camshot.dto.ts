import { OmitType } from '@nestjs/swagger';
import { Camshot } from '../entity/camshot.entity';

export class CreateCamshotDTO extends OmitType(Camshot,
	['id', 'file', 'thumb', 'title', 'createdAt', 'updatedAt', 'deletedAt'] as const) { }
