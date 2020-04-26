import { SafeResourceUrl } from '@angular/platform-browser';
import { ITenant } from './tenant.model';
import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface IIntegrationSetting {
	integration: IIntegration;
	settingsName: string;
	settingsValue: string;
}

export interface IIntegrationEntitySetting {
	// integration: IIntegration;
	entity: string;
	sync: boolean;
	tiedEntities?: any[];
}

export interface IIntegrationMap {
	integration: IIntegration;
	sourceId: string;
	gauzyId: string;
}

export interface IIntegrationViewModel {
	title: string;
	imgSrc: string | SafeResourceUrl;
	navigation_url: string;
}

export interface IIntegration extends IBaseEntityModel {
	tenant: ITenant;
	name: string;
	entitySettings?: IIntegrationEntitySetting[];
}

export enum IntegrationEnum {
	UPWORK = 'Upwork',
	HUBSTAFF = 'Hubstaff'
}

export enum IntegrationEntity {
	PROJECT = 'Project',
	ORGANIZATION = 'Organization',
	NOTE = 'Note',
	CLIENT = 'Client',
	TASK = 'Task',
	ACTIVITY = 'Activity',
	USER = 'User',
	EMPLOYEE = 'Employee',
	TIME_LOG = 'TimeLog',
	TIME_SLOT = 'TimeSlot'
}
