import { ID } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { BaseVideoDTO } from './base-video.dto';
import { FileDTO } from './file.dto';

export class UpdateVideoDTO extends BaseVideoDTO {
	@ApiProperty({ description: 'The ID of the video to update', example: '123e4567-e89b-12d3-a456-426614174000' })
	@IsNotEmpty()
	@IsUUID()
	id: ID;

	@ApiProperty({ type: FileDTO })
	@ValidateNested()
	@Type(() => FileDTO)
	@IsOptional()
	file?: FileDTO;
}
