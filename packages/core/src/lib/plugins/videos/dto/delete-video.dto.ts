import { ID, IDeleteVideo } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class DeleteVideoDTO {
	/**
	 * The ID of the video to delete
	 */
	@ApiProperty({ description: 'The ID of the video to delete', example: '123e4567-e89b-12d3-a456-426614174000' })
	@IsNotEmpty()
	@IsUUID()
	readonly id: ID;

	/**
	 * The options to delete the video
	 */
	@ApiProperty({ required: false })
	@IsOptional()
	options?: IDeleteVideo;
}
