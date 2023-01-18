import { IStatusCreateInput } from '@gauzy/contracts';
import { StatusDTO } from './status.dto';

export class CreateStatusDTO extends StatusDTO implements IStatusCreateInput {}
