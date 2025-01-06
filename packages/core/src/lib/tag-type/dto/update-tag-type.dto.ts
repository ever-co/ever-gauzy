import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { ID, ITagTypeUpdateInput } from '@gauzy/contracts';

export class UpdateTagTypeDTO implements ITagTypeUpdateInput {
	@ApiProperty({ type: () => String })
	@IsString()
	readonly id: ID;
}
