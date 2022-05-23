import { IOrganization } from "index";

export interface IProject {
	name: string;
	count: number;
	organization: Promise<IOrganization> | null;
}
