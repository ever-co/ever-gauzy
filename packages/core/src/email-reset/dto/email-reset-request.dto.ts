import { IResetEmailRequest } from "@gauzy/contracts";
import { UserEmailDTO } from "../../user/dto";

/**
 * Reset Email Request DTO validation
 */
export class ResetEmailRequestDTO extends UserEmailDTO implements IResetEmailRequest {}
