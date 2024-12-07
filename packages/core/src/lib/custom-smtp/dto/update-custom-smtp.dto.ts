import { ICustomSmtpUpdateInput } from "@gauzy/contracts";
import { CreateCustomSmtpDTO } from "./create-custom-smtp.dto";

/**
 * Updates custom SMTP Request DTO validation
 */
export class UpdateCustomSmtpDTO extends CreateCustomSmtpDTO implements ICustomSmtpUpdateInput { }
