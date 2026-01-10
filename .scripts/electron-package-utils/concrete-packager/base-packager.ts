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
}
