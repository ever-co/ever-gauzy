export const metaData = {
	getActivity: (knex, date) => {
		return knex
			.raw(
				`
            SELECT * from heartbeats where DATETIME(time, 'unixepoch') <= datetime(?) and DATETIME(time, 'unixepoch') > DATETIME(?);
        `,
				[date.end, date.start]
			)
			.then((res) => res);
	},
	removeActivity: (knex, data) => {
		return knex('heartbeats')
			.whereIn('id', data.idsWakatime)
			.del()
			.then((res) => res);
	}
};
