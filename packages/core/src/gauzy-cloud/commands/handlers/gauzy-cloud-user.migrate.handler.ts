import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { of as observableOf } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { GauzyCloudService } from '../../gauzy-cloud.service';
import { GauzyCloudUserMigrateCommand } from './../gauzy-cloud-user.migrate.command';

@CommandHandler(GauzyCloudUserMigrateCommand)
export class GauzyCloudUserMigrateHandler implements ICommandHandler<GauzyCloudUserMigrateCommand> {

	constructor(
		private readonly gauzyCloudService: GauzyCloudService
	) {}

	public async execute(command: GauzyCloudUserMigrateCommand): Promise<any> {
		const { input } = command;
		return this.gauzyCloudService.migrateUser(input).pipe(
			switchMap((response: any) => {
				if (response && response.data) {
					const { data } = response;
					const { password } = input;
					const request = {
						findObj: {
							email: data.email
						},
						password
					}
					return this.gauzyCloudService.extractToken(request);
				}
			}),
			catchError((error) => {
				console.log('Bad Promise:', error);
				return observableOf(error)
			})
		);
	}
}
