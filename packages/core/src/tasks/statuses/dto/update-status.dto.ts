import { IStatusUpdateInput } from '@gauzy/contracts';
import { StatusDTO } from './status.dto';

export class UpdatesStatusDTO extends StatusDTO implements IStatusUpdateInput {}
