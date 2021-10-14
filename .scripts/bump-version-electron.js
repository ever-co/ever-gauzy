
const fs = require('fs');
const { exec } = require('child_process');

// TODO: combine all 3 functions below to one with parameter :)

module.exports.server = () => {
    if (fs.existsSync('./apps/server/src/package.json')) {
        let package = require('../apps/server/src/package.json');
        let currentVersion = package.version;
    
        exec('git fetch --tags && git tag --sort version:refname | tail -1', (error, stdout) => {
            if (error) {
                console.error(`exec error: ${error}`);
                return;
            }
        
            let newVersion = stdout.trim();
            console.log('latest tag', newVersion);
            if (newVersion) {
                newVersion = newVersion.split('v')[1];
                package.version = newVersion;
                fs.writeFileSync('./apps/server/src/package.json', JSON.stringify(package, null, 2));
            
                let updated = require('../apps/server/src/package.json');
                console.log('Version updated to version => ', updated.version);
            } else {
                console.log('Latest tag is not found. build server with default version', currentVersion);
            }

        });
    }
}


module.exports.desktop = () => {
    if (fs.existsSync('./apps/desktop/src/package.json')) {
        let package = require('../apps/desktop/src/package.json');
        let currentVersion = package.version;
    
        exec('git fetch --tags && git tag --sort version:refname | tail -1', (error, stdout) => {
            if (error) {
                console.error(`exec error: ${error}`);
                return;
            }
        
            let newVersion = stdout.trim();
            console.log('latest tag', newVersion);
            if (newVersion) {
                newVersion = newVersion.split('v')[1];
                package.version = newVersion;
                fs.writeFileSync('./apps/desktop/src/package.json', JSON.stringify(package, null, 2));
            
                let updated = require('../apps/desktop/src/package.json');
                console.log('Version updated to version => ', updated.version);
            } else {
                console.log('Latest tag is not found. build desktop app with default version', currentVersion);
            }

        });
    }
}

module.exports.desktoptimer = () => {
    if (fs.existsSync('./apps/desktop-timer/src/package.json')) {
        let package = require('../apps/desktop-timer/src/package.json');
        let currentVersion = package.version;
    
        exec('git fetch --tags && git tag --sort version:refname | tail -1', (error, stdout) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return;
        }
    
        let newVersion = stdout.trim();
        console.log('latest tag', newVersion);
        if (newVersion) {
            newVersion = newVersion.split('v')[1];
            package.version = newVersion;
            fs.writeFileSync('./apps/desktop-timer/src/package.json', JSON.stringify(package, null, 2));
        
            let updated = require('../apps/desktop-timer/src/package.json');
            console.log('Version updated to version', updated.version);
        } else {
            console.log('Latest tag is not found. build desktop-timer app with default version', currentVersion);
        }
    });
    }
}
