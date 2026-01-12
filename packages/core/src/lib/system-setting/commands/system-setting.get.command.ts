import { ICommand } from '@nestjs/cqrs';
import { SystemSettingScope } from '@gauzy/contracts';

export class SystemSettingGetCommand implements ICommand {
	static readonly type = '[SystemSetting] Get With Cascade';

	constructor(public readonly names: string[]) {}
}

export class SystemSettingGetByScopeCommand implements ICommand {
	static readonly type = '[SystemSetting] Get By Scope';

	constructor(public readonly scope?: SystemSettingScope) {}
}
