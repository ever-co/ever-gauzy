import { IPackage } from '../interfaces/i-package';
import { IPackager } from '../interfaces/i-packager';

export abstract class BasePackager implements IPackager {
	public abstract prepare(pkg: IPackage): IPackage;

	public preparePublishChannel(pkg: IPackage, arch: string): IPackage {
		pkg.build.publish = pkg.build.publish.map((publish) => {
			publish.channel = `latest-${arch}`;
			return publish;
		});
		return pkg;
	}

	protected registerProtocol(pkg: IPackage, protocol: string): IPackage {
		pkg.build.protocols = [
			{
				name: `${protocol} Protocol`,
				schemes: [protocol],
				role: 'Editor'
			}
		];

		// macOS: register URL scheme via CFBundleURLTypes
		pkg.build.mac.extendInfo = {
			...pkg.build.mac.extendInfo,
			CFBundleURLTypes: [
				{
					CFBundleURLName: `${protocol} Protocol`,
					CFBundleURLSchemes: [protocol],
					CFBundleTypeRole: 'Editor'
				}
			]
		};

		// Linux: register protocol handler via MIME type
		pkg.build.linux.mimeTypes = [
			...(pkg.build.linux.mimeTypes || []),
			`x-scheme-handler/${protocol}`
		];

		// Windows (NSIS): register protocol handler
		pkg.build.nsis = {
			...pkg.build.nsis,
			perMachine: true
		};

		return pkg;
	}
}
