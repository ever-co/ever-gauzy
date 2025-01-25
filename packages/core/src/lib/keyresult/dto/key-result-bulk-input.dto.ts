import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { CreateKeyResultDTO } from './create-key-result.dto';

export class KeyResultBulkInputDTO {
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CreateKeyResultDTO)
	list: CreateKeyResultDTO[];
}
