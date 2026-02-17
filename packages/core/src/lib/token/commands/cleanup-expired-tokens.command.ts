import { ICommand } from '@nestjs/cqrs';

export class CleanupExpiredTokensCommand implements ICommand {}
