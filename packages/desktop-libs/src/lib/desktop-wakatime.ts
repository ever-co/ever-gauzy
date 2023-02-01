export const metaData = {
	getActivity: (knex, date) => {
		return knex
			.select('*')
			.from('heartbeats')
			.whereBetween('time', [date.end, date.start])
			.then((res) => res)
			.catch((error) => console.log(error));
	},
	removeActivity: (knex, data) => {
		return knex('heartbeats')
			.whereIn('id', data.idsWakatime)
			.del()
			.then((res) => res)
			.catch((error) => console.log(error));
	}
};
