import { BaseEntityModel, Employee } from '@gauzy/models';
import { LeadAttribute } from './lead-attribute.model';



export interface Lead extends BaseEntityModel, LeadCreateInput
{
  leadAttributes: LeadAttribute[];
  saleRepresentative: Employee;
  // client: Client;
}

export type LeadFindInput = Partial<LeadCreateInput>;

export interface LeadCreateInput
{
  saleRepresentativeId: string;
  // clientId: string;
}
