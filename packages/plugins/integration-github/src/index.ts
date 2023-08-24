import type { Probot, Context } from 'probot';

export default (app: Probot) => {
	app.log('Yay! The app was loaded!');

	app.on('issues.opened', async (context) => {
		// Here we can have logic to sync with Gauzy API

		console.log('context.isBot', context.payload);

		return context.octokit.issues.createComment(
			context.issue({
				body: `Hi @${context.payload.sender.login}, Thank you for opening this Issue `,
			})
		);
	});

	app.on('issues.closed', async (context: Context) => {
		// Here we can have logic to sync with Gauzy API

		return context.octokit.issues.createComment(
			context.issue({ body: 'Closed!' })
		);
	});

	app.on('issue_comment.created', async (context: Context) => {
		// Here we can have logic to sync with Gauzy API

		// context.payload is actually webhook payload
		console.log(context.payload);

		if (context.isBot) {
			// This condition will help us to idenity if request was done by bot
			// and using it we can prevent infinity loop
			return;
		}

		return context.octokit.issues.createComment(
			context.issue({ body: 'Again commented!' })
		);
	});
};
