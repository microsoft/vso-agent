var _testPublisher = (function(){
    function TestPublisher(testRunner) {
    	this.testRunner = testRunner;        
    }

    TestPublisher.prototype.publish = function(resultFiles, mergeResults, platform, config) {
    	
    	var properties = 'type=' + this.testRunner + ';platform=' + platform + ';config=' + config;
    	
    	if(mergeResults == 'true') {
    		console.log("Merging test results from multiple files to one test run is not supported on this version of build agent for OSX/Linux, each test result file will be published as a separate test run in VSO/TFS.")
    	}

    	for(var i = 0; i < resultFiles.length; i ++) {
        	console.log('##vso[results.publish type=' + this.testRunner + ';platform=' + platform + ';config=' + config + ']' + resultFiles[i]);
    	}
    }

    return TestPublisher;
})();
exports.TestPublisher = _testPublisher;
