import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, IsNotEmpty, Length, Matches, ValidateNested } from 'class-validator';
import { BaseVideoDTO } from './base-video.dto';
import { FileDTO } from './file.dto';

export class CreateVideoDTO extends BaseVideoDTO {
	@ApiProperty({
		description: 'The title of the video',
		example: 'My Project Demo Video 2024',
		minLength: 3,
		maxLength: 255
	})
	@IsDefined({ message: 'Title is required and cannot be empty.' })
	@IsNotEmpty({ message: 'Title is required' })
	@Length(3, 255, { message: 'Title must be between 3 and 255 characters' })
	@Matches(/^[\w\s-]+$/i, {
		message: 'Title can only contain letters, numbers, spaces, and hyphens'
	})
	title: string;

	@ApiProperty({
		type: FileDTO,
		description: 'The uploaded video file object containing metadata and properties',
		required: true
	})
	@ValidateNested({ message: 'File must be a valid FileDTO object' })
	@Type(() => FileDTO)
	file: FileDTO;
}
