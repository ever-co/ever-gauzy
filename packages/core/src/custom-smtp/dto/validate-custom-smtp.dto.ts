import { ICustomSmtpValidateInput } from "@gauzy/contracts";
import { CreateCustomSmtpDTO } from "./create-custom-smtp.dto";

/**
 * Validate custom Smtp Request DTO validation
 */
export class ValidateCustomSmtpDTO extends CreateCustomSmtpDTO implements ICustomSmtpValidateInput { }
