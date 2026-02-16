import { ICommand } from '@nestjs/cqrs';
import { IRotateTokenDto } from '../interfaces/token.interface';

export class RotateTokenCommand implements ICommand {
	constructor(public readonly dto: IRotateTokenDto) {}
}
