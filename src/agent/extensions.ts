// 
// Copyright (c) Microsoft and contributors.  All rights reserved.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// 
// See the License for the specific language governing permissions and
// limitations under the License.
// 

interface String {
   startsWith(str): boolean;
   endsWith(str): boolean;
   isEqual(ignoreCase, str): boolean;
   replaceVars(vars): string;
}

String.prototype.startsWith = function (str) {
    return this.slice(0, str.length) == str;
}

String.prototype.endsWith = function (str) {
    return this.slice(-str.length) == str;
}

String.prototype.isEqual = function(ignoreCase, str) {
	var str1 = this;

	if (ignoreCase) {
		str1 = str1.toLowerCase();
	    str = str.toLowerCase();			
	}

	return str1 === str;
}

//
// "This $(somevar) and $(somevar2) replaced".replaceVars({somevar:someval, somevar2:someval2})
//
String.prototype.replaceVars = function (vars) {
    return this.replace(/\$\(([^\)]+)\)/g, function (placeholder, variable) {
    	if (vars[variable]) {
    		return vars[variable];
    	}
    	else {
    		return placeholder;
    	}
    });
};
