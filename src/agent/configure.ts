// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import cfgm = require("./configuration");
import ifm = require('./api/interfaces');
import dm = require('./diagnostics');
import cm = require('./common');

var cfgr: cfgm.Configurator = new cfgm.Configurator();
cm.readBasicCreds()
.then((credentials: ifm.IBasicCredentials) => {
    return cfgr.create(credentials);
})
.then((settings: cm.ISettings) => {
	console.log('Configured ' + settings.agentName + ' in pool ' + settings.poolName);
})
.fail((err: Error) => {
	console.error('Configuration Failed:');
	console.error(err.message);
});
