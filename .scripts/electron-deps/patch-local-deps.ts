import * as fs from 'fs';
import * as path from 'path';
import { IPackage } from '../electron-package-utils/interfaces/i-package';

const argv = process.argv.slice(2);

const get = (k: string, d: string) => {
	const i = argv.findIndex((a) => a.startsWith(`${k}=`));
	return i >= 0 ? argv[i].split('=')[1] : d;
}

const DIST = path.resolve(get('--dist', 'dist'));
const Scopes = get('--scope', '@gauzy').split(',').map((s: string) => s.trim()).filter((Boolean));
const apps = get('--apps', 'desktop').split(',').map((s) => s.trim()).filter(Boolean);

const isDry = argv.includes('--dry');

const appDir = (name: string) => path.join(DIST, 'apps', name);
const pkgJson = (directory: string) => path.join(directory, 'package.json');
const exists = (pathFile: string) => fs.existsSync(pathFile);
const getModuleName = (pathFile: string): string => {
	const json = JSON.parse(fs.readFileSync(pkgJson(pathFile), 'utf8'));
	return json?.name;
}

function filterDeps(deps: Record<string, unknown>) {
	const usedPkg: string[] = [];
	const depsKeys: string[] = Object.keys(deps);
	for (const dep of depsKeys) {
		if (Scopes.some((s: string) => dep.startsWith(s))) {
			usedPkg.push(dep);
		}
	}
	return usedPkg;
}

function depsApps() {
	const deps: string[] = [];
	for (const app of apps) {
		const dir = appDir(app);
		const json = JSON.parse(fs.readFileSync(pkgJson(dir), 'utf8'));
		if (json?.dependencies) {
			const depsNeeded = filterDeps(json.dependencies);
			deps.push(...depsNeeded);
		}
	}
	return deps;
}

function requiredDeps(p: string) {
	const deps = depsApps();
	return deps.some((d) => getModuleName(p) === d)
}


function listPackageDirs(root: string) {
	if (!exists(root)) return [];
	const dirs: string[] = fs.readdirSync(root).map((name: string) => path.join(root, name));
	const pkgDirs: string[] = [];
	for (const dir of dirs) {
		if (exists(pkgJson(dir))) {
			pkgDirs.push(dir);
		} else {
			const nestPkg = listPackageDirs(dir);
			pkgDirs.push(...nestPkg);
		}
	}
	return pkgDirs.filter((pkg) => requiredDeps(pkg));
}

function findLocalPackage(root: string, packageName: string): string | null {
	let pathPkg: string | null = null;
	if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
		return null;
	}
	const dirNames = fs.readdirSync(root);
	for (const name of dirNames) {
		const pathName = path.join(root, name);
		if (exists(pathName)) {
			const moduleName = getModuleName(pathName);
			if (moduleName === packageName) {
				pathPkg = pathName;
				break;
			}
		} else {
			pathPkg = findLocalPackage(pathName, packageName);
			if (pathPkg) {
				break;
			}
		}
	}
	return pathPkg;
}

const pkgRoots = ['packages'].map((n) => path.join(DIST, n)).filter(exists);

const packageDir = pkgRoots.flatMap(listPackageDirs);
const nameToDir: Record<string, string> = {}
for (const dir of packageDir) {
	const json = JSON.parse(fs.readFileSync(pkgJson(dir), 'utf8'));
	if (json?.name) nameToDir[json.name] = dir;
}

const inScope = (name: string) => Scopes.some((s) => name.startsWith(s));

const relFile = (from: string, to: string) => `file:${path.relative(from, to).split(path.sep).join('/')}`;

function rewriteSection(pkgDir: string, json: IPackage, sections: string[]): boolean {
	let changed = false;
	for (const sec of sections) {
		const deps = json[sec as keyof IPackage] as Record<string, string> | undefined;
		if (!deps) continue;
		for (const dep of Object.keys(deps)) {
			if (inScope(dep)) {
				if (!nameToDir[dep]) {
					const currentDep = findLocalPackage(path.join(DIST, 'packages'), dep);
					if (currentDep) nameToDir[dep] = currentDep;
				}
				if (nameToDir[dep]) {
					const want = relFile(pkgDir, nameToDir[dep]);
					if (deps[dep] !== want) {
						deps[dep] = want;
						changed = true;
					}
				}
			}
		}
	}
	return changed;
}

function patchOne(pkgDir: string) {
	const pathFile = pkgJson(pkgDir);
	if (!exists(pathFile)) return false;
	const json = JSON.parse(fs.readFileSync(pathFile, 'utf8'));
	let changed = false;

	changed ||= rewriteSection(pkgDir, json, ['dependencies']);

	if (changed && !isDry) {
		fs.writeFileSync(pathFile, JSON.stringify(json, null, 2));
	}

	if (changed) {
		console.log(`patched ${json.name} at ${pathFile}`);
	}

	return changed;
}

let count = 0;
for (const dir of packageDir) {
	if (patchOne(dir)) {
		count += 1;
	}
}
