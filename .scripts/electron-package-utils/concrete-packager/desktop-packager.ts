import { IPackage } from '../interfaces/i-package';
import { BasePackager } from './base-packager';
import { env } from '../../env';

export class DesktopPackager extends BasePackager {
	public prepare(pkg: IPackage): IPackage {
		pkg.name = env.DESKTOP_APP_NAME || pkg.name;
		pkg.productName = env.DESKTOP_APP_DESCRIPTION || pkg.productName;
		pkg.description = env.DESKTOP_APP_DESCRIPTION || pkg.description;
		pkg.homepage = env.COMPANY_SITE_LINK || pkg.homepage;
		pkg.build.appId = env.DESKTOP_APP_ID || pkg.build.appId;
		pkg.build.productName =
			env.DESKTOP_APP_DESCRIPTION || pkg.build.productName;
		pkg.build.linux.executableName =
			env.DESKTOP_APP_NAME || pkg.build.linux.executableName;
		return pkg;
	}
}
