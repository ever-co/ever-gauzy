import { IResendEmailInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';

export class ResendEmailHistoryDTO extends TenantOrganizationBaseDTO implements IResendEmailInput {}
