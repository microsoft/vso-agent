// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

var readline = require("readline")
  , async = require('async')
  , argparser = require('minimist');

var args = argparser(process.argv.slice(2));

var getValueFromString = function (val, valtype, fallback) {
    var retVal = val;

    switch (valtype) {
        case "number":
            retVal = Number(val);
            if (isNaN(retVal))
                retVal = fallback;
            break;
        case "boolean":
            retVal = ((val.toLowerCase() === "true") || (val === "1"));
            break;
    }

    return retVal;
};

// done(err, result)
export function get(inputs, done) {
	var result = {};
	result['_'] = args['_'];

    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    async.forEachSeries(inputs, function (input, inputDone) {
    	if (args[input.arg]) {
    		result[input.name] = args[input.arg];
    		inputDone(null, null);
    		return;
    	}

    	var msg = 'Enter ' + input.description;
    	if (input.def) {
    		msg += ' (enter sets ' + input.def + ') ';
    	} 
    	msg += ' > ';

        rl.question(msg, function (answer) {
            var useVal = answer === "" ? input.def : answer;
            result[input.name] = getValueFromString(useVal, input.type, input.default);
            inputDone(null, null);
        });    		
    }, function(err) {
        rl.close();
        
    	if (err) {
    		done(err, null);
    		return;
    	}

    	// final validation
    	inputs.forEach(function(input) {
    		//console.log(input.name, input.req, result[input.name], result.hasOwnProperty(input.name));
    		if (input.req && !result[input.name]) {
    			done(new Error(input.description + ' is required.'), null);
    			return;
    		}
    	});

    	done(null, result);
    });
}
