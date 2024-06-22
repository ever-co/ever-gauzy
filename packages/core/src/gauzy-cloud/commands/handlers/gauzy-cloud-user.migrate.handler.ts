import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { switchMap, catchError } from 'rxjs/operators';
import { i4netCloudService } from '../../gauzy-cloud.service';
import { i4netCloudUserMigrateCommand } from './../gauzy-cloud-user.migrate.command';

@CommandHandler(i4netCloudUserMigrateCommand)
export class i4netCloudUserMigrateHandler implements ICommandHandler<i4netCloudUserMigrateCommand> {

	constructor(
		private readonly gauzyCloudService: i4netCloudService
	) { }

	public async execute(command: i4netCloudUserMigrateCommand): Promise<any> {
		const { input } = command;
		return this.gauzyCloudService.migrateUser(input).pipe(
			switchMap((response: any) => {
				if (response && response.data) {
					const { data } = response;
					const { password } = input;
					return this.gauzyCloudService.extractToken({
						email: data.email,
						password
					});
				}
			}),
			catchError((error) => {
				console.log('Bad Promise:', error);
				throw new BadRequestException(error);
			})
		);
	}
}
