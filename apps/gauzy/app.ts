import connect from 'connect';
import * as path from 'path';
import serveStatic from 'serve-static';

// Define the port number from environment variables or default to 4250
const port: number = Number(process.env.WEB_PORT) || 4250;

// Set up the server using connect and serve static files
connect()
	.use(serveStatic(path.join(__dirname, '../../dist/apps/gauzy')))
	.listen(port, () => {
		console.log(`Listening on port ${port}`);
	});
