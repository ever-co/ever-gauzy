import { SafeResourceUrl } from '@angular/platform-browser';
import { Tenant } from './tenant.model';
import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface IIntegrationSetting {
	integration: IIntegration;
	settingsName: string;
	settingsValue: string;
}

export interface IIntegrationViewModel {
	title: string;
	imgSrc: string | SafeResourceUrl;
	navigation_url: string;
}

export interface IIntegration extends IBaseEntityModel {
	tenant: Tenant;
	name: string;
}

export enum IntegrationEnum {
	UPWORK = 'Upwork',
	HUBSTAFF = 'Hubstaff'
}
