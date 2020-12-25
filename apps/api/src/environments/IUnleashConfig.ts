export interface IUnleashConfig {
	url: string;
	appName: string;
	environment?: string;
	instanceId?: string;
	refreshInterval: number;
	metricsInterval: number;
}
