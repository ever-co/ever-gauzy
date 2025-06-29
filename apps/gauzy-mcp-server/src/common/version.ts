import * as pkg from '../../package.json';

interface PackageJson {
  version: string;
}


export function getVersion() {
  return (pkg as PackageJson).version;
}
