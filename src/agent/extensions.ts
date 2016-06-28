// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

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
    function recursiveResolve(inputValue, stack) {
      return inputValue.replace(/\$\(([^\)]+)\)/g, function (placeholder, variable) {
        var lowerVar = variable.toLowerCase();
        
        if (stack.indexOf(lowerVar) === -1 && vars[lowerVar]) {
          stack.push(lowerVar);
          var replacement = recursiveResolve(vars[lowerVar], stack);
          stack.pop();
          return replacement;
        }
        
        return placeholder;
      });
    }
    
    return recursiveResolve(this, []);
};
