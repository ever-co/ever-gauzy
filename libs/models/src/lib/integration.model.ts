import { SafeResourceUrl } from '@angular/platform-browser';

export interface IIntegrationViewModel {
	title: string;
	imgSrc: string | SafeResourceUrl;
	navigation_url: string;
}
