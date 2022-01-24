import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { Tag } from '../tag.entity';

export class CreateTagsDto extends Tag {

    @ApiProperty({ type: () => String })
	@IsNotEmpty()
	name: string;

}