interface NodeModule {
	id: string;
}
interface Window {
	process: any;
	require: any;
	variableGlobal: {
		API_BASE_URL: string,
		IS_INTEGRATED_DESKTOP: boolean
	} | any
}

declare module NodeJS {
	interface Global {
		variableGlobal: any;
	}
}
