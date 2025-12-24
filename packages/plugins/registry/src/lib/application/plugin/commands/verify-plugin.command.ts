import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';
import { VerifyPluginDTO } from '../../../shared';

export class VerifyPluginCommand implements ICommand {
	public static readonly type = '[Plugin] Verify Plugin';
	constructor(public readonly pluginId: ID, public readonly input: VerifyPluginDTO) {}
}
