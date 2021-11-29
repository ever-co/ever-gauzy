var connect = require('connect');
var path = require('path');
var serveStatic = require('serve-static');
const port = process.env.WEB_PORT || 4250;

connect()
	.use(serveStatic(path.join(__dirname, '../../dist/apps/gauzy')))
	.listen(port);
console.log('listening on ' + port);
