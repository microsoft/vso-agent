var util = require('util');

// Jake looks for Jakefile.js by default

/*
-V/v
--version                   Display the Jake version.

-h
--help                      Display help message.

-f *FILE*
--jakefile *FILE*           Use FILE as the Jakefile.

-C *DIRECTORY*
--directory *DIRECTORY*     Change to DIRECTORY before running tasks.

-q
--quiet                     Do not log messages to standard output.

-J *JAKELIBDIR*
--jakelibdir *JAKELIBDIR*   Auto-import any .jake files in JAKELIBDIR.
                            (default is 'jakelib')

-B
--always-make               Unconditionally make all targets.

-t
--trace                     Enable full backtrace.

-T/ls
--tasks                     Display the tasks (matching optional PATTERN)
                            with descriptions, then exit.
*/

// Default Tasks
//
// run: jake

desc('This is the default task.');
task('default', [], function (params) {
  console.log('This is the default task.');
  // console.log(sys.inspect(arguments));
});

// Async Tasks
// run: jake asyncTask
desc('This is an asynchronous task.');
task('asyncTask', {async: true}, function () {
  console.log('This is an async task');

  // async tasks must call complete
  setTimeout(function(){
        console.log('done with async task')
        complete();
  }, 3000);
});

// namespaces: use namespace:task
//
namespace('sample', function () {
  // Tasks with params
  // run: jake outputMsg[output, Hello World]
  desc('Send message task.');
  task('outputMsg', function (tag, msg) {
    console.log(util.inspect(arguments));
    console.log(tag, msg);
  });

  desc('Say Hello.');
  task('sayHello', ['asyncTask'], function (name) {
      console.log('Hello World');
  });  

  // will run dependent tasks.
  // invokes other tasks
  // invoke runs tasks and dependencies
  // execute calls task without dependencies 
  //
  // run: jake jaketask[output, 'Hello World']

  desc('This the sample:jaketask');
  task('jaketask', ['default', 'sample:sayHello'], function (tag, msg) {
    console.log('running jaketask');
    console.log(util.inspect(arguments));
    jake.Task['sample:outputMsg'].invoke(tag, msg);
  });  
});

// Cleanup - on complete.  Runs when jake script is complete

jake.addListener('complete', function () {
    console.log('Script Cleanup');
});

