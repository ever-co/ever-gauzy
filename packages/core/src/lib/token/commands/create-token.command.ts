import { ICommand } from '@nestjs/cqrs';
import { ICreateTokenDto } from '../interfaces/token.interface';

export class CreateTokenCommand implements ICommand {
	constructor(public readonly dto: ICreateTokenDto) {}
}
