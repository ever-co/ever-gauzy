import { ICommand } from '@nestjs/cqrs';

export class TenantSettingGetCommand implements ICommand {
	static readonly type = '[Tenant] Setting Get';

	constructor() {}
}
