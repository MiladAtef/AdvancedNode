const util = require('util');
const redis = require('redis');
const mongoose = require('mongoose');
const keys = require('../config/keys');

const client = redis.createClient(keys.redisUrl);
client.hget = util.promisify(client.hget);
const exec = mongoose.Query.prototype.exec;

// this is a custom function we write for caching specific queries we want to cache
mongoose.Query.prototype.cache = function(options = {}) {
	// when we call this function we create the variable 'useCache'
	// and assign its value to true
	// then we use this variable in the 'exec' function down below
	// to check if the query needs to be cached or not
	this.useCache = true;
	this.hashKey = JSON.stringify(options.key || '');

	return this; // just to make the function chainable
};

//we here overriding the 'exec' function that exists in the Query constructor
mongoose.Query.prototype.exec = async function() {
	// if 'useCache' is false we don't cache and just return the original 'exec' function
	if (!this.useCache) {
		return exec.apply(this, arguments);
	}

	const key = JSON.stringify(
		Object.assign({}, this.getQuery(), {
			collection: this.mongooseCollection.name
		})
	);

	//see if we have a value for 'key' in redis
	const cacheValue = await client.hget(this.hashKey, key);

	//if we do, return that
	if (cacheValue) {
		const doc = JSON.parse(cacheValue);

		//check to see if the doc is an array of docs or just a single record
		return Array.isArray(doc)
			? doc.map(d => new this.model(d))
			: new this.model(doc);
	}

	//otherwise, issue the query and store the result in redis
	const result = await exec.apply(this, arguments);
	client.hset(this.hashKey, key, JSON.stringify(result));
	return result;
};

module.exports = {
	clearHash(hashKey) {
		client.del(JSON.stringify(hashKey));
	}
};
