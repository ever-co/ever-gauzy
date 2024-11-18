import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { LanguagesEnum } from '@gauzy/contracts';
import { WorkspaceSigninSendCodeCommand } from '../workspace-signin-send-code.command';
import { AuthService } from '../../auth.service';

@CommandHandler(WorkspaceSigninSendCodeCommand)
export class WorkspaceSigninSendCodeCommandHandler implements ICommandHandler<WorkspaceSigninSendCodeCommand> {

	constructor(
		private readonly authService: AuthService
	) { }

	public async execute(command: WorkspaceSigninSendCodeCommand): Promise<any> {
		try {
			const { input, locale = LanguagesEnum.ENGLISH } = command;
			await this.authService.sendWorkspaceSigninCode(input, locale);
		} finally {
			return new Object({
				status: HttpStatus.OK,
				message: `OK`
			});
		}
	}
}
