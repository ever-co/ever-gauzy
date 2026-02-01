const fs = require('fs');
const path = require('path');

function findProjects(dir) {
	const results = [];
	try {
		const items = fs.readdirSync(dir, { withFileTypes: true });

		for (const item of items) {
			if (item.isDirectory()) {
				const projPath = path.join(dir, item.name, 'project.json');

				if (fs.existsSync(projPath)) {
					results.push({ name: item.name, projPath, dir: path.join(dir, item.name) });
				}

				// Check subdirectories (for plugins)
				const subDir = path.join(dir, item.name);
				try {
					const subItems = fs.readdirSync(subDir, { withFileTypes: true });
					for (const subItem of subItems) {
						if (subItem.isDirectory()) {
							const subProjPath = path.join(subDir, subItem.name, 'project.json');
							if (fs.existsSync(subProjPath)) {
								results.push({
									name: subItem.name,
									projPath: subProjPath,
									dir: path.join(subDir, subItem.name)
								});
							}
						}
					}
				} catch (e) {}
			}
		}
	} catch (e) {
		console.error('Error scanning directory:', e.message);
	}
	return results;
}

const projects = findProjects('packages');
console.log('Found', projects.length, 'projects\n');

let fixedCount = 0;

for (const proj of projects) {
	try {
		const projJson = JSON.parse(fs.readFileSync(proj.projPath, 'utf8'));

		// Skip if no implicitDependencies
		if (!projJson.implicitDependencies || projJson.implicitDependencies.length === 0) {
			continue;
		}

		// Check if build target exists and needs dependsOn
		if (projJson.targets && projJson.targets.build) {
			const build = projJson.targets.build;

			// Check if already has dependsOn with ^build
			if (build.dependsOn && build.dependsOn.includes('^build')) {
				continue;
			}

			// Add dependsOn
			if (!build.dependsOn) {
				build.dependsOn = ['^build'];
			} else if (!build.dependsOn.includes('^build')) {
				build.dependsOn.unshift('^build');
			}

			fs.writeFileSync(proj.projPath, JSON.stringify(projJson, null, '\t') + '\n');
			console.log('Fixed:', proj.name);
			fixedCount++;
		}
	} catch (e) {
		console.error('Error processing', proj.name, ':', e.message);
	}
}

console.log('\nTotal fixed:', fixedCount);
