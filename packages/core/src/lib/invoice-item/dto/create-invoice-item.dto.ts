import { IInvoiceItemCreateInput} from "@gauzy/contracts";
import { InvoiceItemDTO } from "./invoice-item.dto";

export class CreateInvoiceItemDTO extends InvoiceItemDTO implements IInvoiceItemCreateInput {}