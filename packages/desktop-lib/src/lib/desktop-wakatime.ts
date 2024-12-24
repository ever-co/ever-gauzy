export const metaData = {
	getActivity: async (knex, date) => {
		try {
			return await knex
				.select('*')
				.from('heartbeats')
				.whereBetween('time', [date.end, date.start]);
		} catch (error) {
			console.error(error);
		}
	},

	removeActivity: async (knex, data) => {
		try {
			return await knex('heartbeats')
				.whereIn('id', data.idsWakatime)
				.del();
		} catch (error) {
			console.error(error);
		}
	},
};
