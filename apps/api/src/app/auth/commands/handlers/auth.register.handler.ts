import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AuthRegisterCommand } from '../auth.register.command';
import { AuthService } from '../../auth.service';
import { User } from '@gauzy/models';

@CommandHandler(AuthRegisterCommand)
export class AuthRegisterHandler implements ICommandHandler<AuthRegisterCommand> {
    constructor(
        private readonly authService: AuthService,
    ) { }

    public async execute(command: AuthRegisterCommand): Promise<User> {
        const { input } = command;

        return await this.authService.register(input);
    }
}
