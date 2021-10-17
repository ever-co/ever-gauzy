declare module NodeJS {
	interface Global {
		variableGlobal: any;
	}
}

declare const nodeModule: NodeModule;
interface NodeModule {
  id: string;
}
interface Window {
  process: any;
  require: any;
}
