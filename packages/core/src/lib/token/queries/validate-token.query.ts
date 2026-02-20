import { IQuery } from '@nestjs/cqrs';
import { IValidateTokenDto } from '../interfaces/token.interface';

export class ValidateTokenQuery implements IQuery {
	constructor(public readonly dto: IValidateTokenDto) {}
}
