export interface IPackage {
	name: string;
	productName: string;
	version: string;
	description: string;
	license: string;
	homepage: string;
	repository: { type: string; url: string };
	bugs: { url: string };
	private: boolean;
	author: { name: string; email: string; url: string };
	main: string;
	workspaces: { packages: string[] };
	build: {
		appId: string;
		artifactName: string;
		productName: string;
		copyright: string;
		afterSign: string;
		dmg: { sign: boolean };
		asar: boolean;
		npmRebuild: boolean;
		asarUnpack: string[];
		directories: { buildResources: string; output: string };
		publish: {}[];
		mac: {
			category: string;
			icon: string;
			target: any[];
			asarUnpack: string;
			artifactName: string;
			hardenedRuntime: boolean;
			gatekeeperAssess: boolean;
			entitlements: string;
			entitlementsInherit: string;
			extendInfo: {};
		};
		win: {
			publisherName: string;
			target: any[];
			icon: string;
			verifyUpdateCodeSignature: boolean;
		};
		linux: {
			icon: string;
			target: any[];
			executableName: string;
			artifactName: string;
			synopsis: string;
			category: string;
		};
		nsis: {
			oneClick: boolean;
			perMachine: boolean;
			createDesktopShortcut: boolean;
			createStartMenuShortcut: boolean;
			allowToChangeInstallationDirectory: boolean;
			allowElevation: boolean;
			installerIcon: string;
			artifactName: string;
			deleteAppDataOnUninstall: boolean;
			menuCategory: boolean;
		};
		extraResources: (string | object[])[];
		extraFiles: string[];
	};
	dependencies: { [key: string]: string };
}
