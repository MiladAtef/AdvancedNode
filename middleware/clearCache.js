const { clearHash } = require('../services/cache');

module.exports = async (req, res, next) => {
	await next();
	clearHash(req.user.id);
};

// we used 'await' before the 'next' func
// because we want the route handler function to run first
// to create the new blog post firstly
// then this middleware function will run
// to clear the cache after the new blog post has been craeted
