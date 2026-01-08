import { ICommand } from '@nestjs/cqrs';
import { SystemSettingScope } from '@gauzy/contracts';

export class SystemSettingSaveCommand implements ICommand {
	static readonly type = '[SystemSetting] Save';

	constructor(
		public readonly input: Record<string, any>,
		public readonly scope: SystemSettingScope
	) {}
}
