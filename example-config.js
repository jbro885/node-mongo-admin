'use strict'

let fs = require('fs')

module.exports = {
	// The port the http will listen to
	port: 8000,
	connections: {
		local: {
			uri: 'mongodb://localhost:27017',
			databases: ['my-db']
		},
		dev: {
			uri: 'mongodb://user:password@dev.example.com:27017',
			databases: ['my-db']
		},
		production: {
			// For more info see http://mongodb.github.io/node-mongodb-native/3.0/api/MongoClient.html#.connect
			uri: 'mongodb://user:password@mongo1.example.com:27017,mongo2.example.com:27017,mongo3.example.com:27017?replicaSet=RS-17&readPreference=secondaryPreferred',
			options: {
				poolSize: 10
			},
			databases: ['my-db']
		}
	},
	aliases: {
		// Alias old connection names to current ones
		// Use this to keep saved query URLs working after migration to v4
		local: 'local.my-db',
		dev: 'dev.my-db',
		production: 'production.my-db'
	},
	// HTTP basic auth, leave null to turn off
	// NOTE: basic HTTP auth is almost useless without https!
	basicAuth: [{
		user: 'user1',
		password: 'pass1', // CHANGE IT!
		// List connections this user can access
		// If no connections is listed, all will be allowed
		connections: ['dev']
	}, {
		user: 'user2',
		password: 'pass2'
	}],
	// https options, for more details see:
	// http://nodejs.org/api/tls.html#tls_tls_createserver_options_secureconnectionlistener
	// Leave null to use http instead of https
	// Is strongly recommended to use https+basic-auth
	https: {
		// NOTE: do not use the default private key, since is was made public!
		// The default is set just as an example and should never be used in production
		key: fs.readFileSync('./keys/example-key.pem'), // CHANGE IT!
		cert: fs.readFileSync('./keys/example-cert.pem') // CHANGE IT!
	}
}