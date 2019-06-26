import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AuthRegisterCommand } from '../auth.register.command';
import { AuthService } from '../../auth.service';

@CommandHandler(AuthRegisterCommand)
export class AuthRegisterHandler implements ICommandHandler<AuthRegisterCommand> {
    constructor(
        private readonly authService: AuthService,
    ) { }

    public async execute(command: AuthRegisterCommand): Promise<void> {
        const { input } = command;

        await this.authService.register(input);
    }
}
