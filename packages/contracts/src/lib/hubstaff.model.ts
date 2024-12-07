import { IBasePerTenantAndOrganizationEntityModel } from "./base-entity.model";
import { TimeLogType } from "./timesheet.model";

export interface IHubstaffAccessTokens {
	access_token: string;
	refresh_token: string;
	token_type: string;
	expires_in: number;
}

export interface ICreateHubstaffIntegrationInput extends IBasePerTenantAndOrganizationEntityModel {
	client_id: string;
	code: string;
	grant_type: string;
	redirect_uri: string;
	client_secret: string;
}

export interface IHubstaffOrganization {
	id: number;
	name: string;
	status: string;
}

export interface IHubstaffOrganizationsResponse {
	organizations: IHubstaffOrganization[]
}


export interface IHubstaffProject {
	id: number;
	name: string;
	status: string;
	created_at: Date;
	updated_at: Date;
	client_id: number;
	billable: boolean;
	metadata: any
}

export interface IHubstaffProjectsResponse {
	projects: IHubstaffProject[],
	clients: Array<any>
}

export interface IHubstaffProjectResponse {
	project: IHubstaffProject
}
export interface IHubstaffTimeSlotActivity {
	id: number;
	date: string;
	time_slot: Date;
	starts_at: Date;
	user_id: number;
	project_id: number;
	task_id?: number;
	keyboard: number;
	mouse: number;
	overall: number;
	tracked: number;
	input_tracked: number;
	tracks_input: boolean;
	billable: boolean;
	paid: boolean;
	client_invoiced: boolean;
	team_invoiced: boolean;
	immutable: boolean;
	time_type: string;
	client: string;
	employeeId?: string;
}

export interface IHubstaffScreenshotActivity {
	id: number;
	full_url: string;
	thumb_url: string;
	date: string,
	time_slot: string;
	recorded_at: string;
	user_id: number;
	project_id: number;
	offset_x: number;
	offset_y: number;
	width: number;
	height: number;
	screen: number;
	employeeId?: string;
}

export interface IHubstaffLogFromTimeSlots {
	id: string,
	date: Date,
	user_id: number,
	project_id: number,
	task_id: number,
	logType: TimeLogType
}
