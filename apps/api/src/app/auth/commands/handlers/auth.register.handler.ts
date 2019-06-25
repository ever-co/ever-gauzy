import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AuthRegisterCommand } from '../auth.register.command';
import { AuthService } from '../../auth.service';
import { UserService } from '../../../user';

@CommandHandler(AuthRegisterCommand)
export class AuthRegisterHandler implements ICommandHandler<AuthRegisterCommand> {
    constructor(
        private readonly userService: UserService,
        private readonly authService: AuthService,
    ) { }

    public async execute(command: AuthRegisterCommand): Promise<void> {
        console.log('command:AuthRegisterCommand', command);
        const { input } = command;

        await this.userService.create({
            ...input.user,
            ...(input.password
                ? {
                    hash: await this.authService.getPasswordHash(
                        input.password
                    )
                }
                : {})
        });
    }
}
