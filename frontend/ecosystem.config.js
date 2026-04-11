module.exports = {
	apps: [{
		name: 'marktplaats',
		script: 'build/index.js',
		interpreter: '/opt/bin/node',
		cwd: '/share/CACHEDEV1_DATA/Container/caddy/apps/marktplaats.jurrejan.com',
		env: {
			NODE_ENV: 'production',
			PORT: 3101,
			ORIGIN: 'https://marktplaats.jurrejan.com'
		}
	}]
};
