// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import cfgm = require("./configuration");
import ifm = require('./api/interfaces');
import dm = require('./diagnostics');
import cm = require('./common');

var config: cfgm.Configurator = new cfgm.Configurator();
config.create((err, host) => {
	if (err) {
		console.error(err);
	}
});
