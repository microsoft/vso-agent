// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import cfgm = require("./configuration");
import ifm = require('./api/interfaces');
import dm = require('./diagnostics');
import cm = require('./common');

var cfgr: cfgm.Configurator = new cfgm.Configurator();
cm.readBasicCreds()
.then((credentials: ifm.IBasicCredentials) => {
    _creds = credentials;
    return cfgr.create(creds);
})
.then((settings: cm.ISettings) => {
	console.log('Configured ' + settings.agentName + ' in pool ' + settings.poolName);
})
.fail((err) => {
	console.err('Configuration Failed:');
	console.err(err.message);
});
