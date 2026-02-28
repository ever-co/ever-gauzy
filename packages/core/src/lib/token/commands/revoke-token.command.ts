import { ICommand } from '@nestjs/cqrs';
import { IRevokeTokenDto } from '../interfaces/token.interface';

export class RevokeTokenCommand implements ICommand {
	constructor(public readonly dto: IRevokeTokenDto) {}
}
