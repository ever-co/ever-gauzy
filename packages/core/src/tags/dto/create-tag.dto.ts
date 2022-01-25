import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ICreateTag } from '@gauzy/contracts';

export class CreateTagDTO implements ICreateTag {

    @ApiProperty({ type: () => String })
	@IsNotEmpty()
	readonly name: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	readonly color: string;

	@ApiProperty({ type: () => String })
	@IsOptional()
	@IsString()
	readonly description?: string;
}