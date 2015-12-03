var fs = require('fs');
var path = require('path');
var gulp = require('gulp');
var del = require('del');
var mocha = require('gulp-mocha');
var tar = require('gulp-tar');
var gzip = require('gulp-gzip');
var merge = require('merge2');
var minimist = require('minimist');
var typescript = require('gulp-tsc');

var buildRoot = path.join(__dirname, '_build');
var tarRoot = path.join(__dirname, '_tar');
var packageRoot = path.join(__dirname, '_package');
var testRoot = path.join(__dirname, '_test');
var testPath = path.join(testRoot, 'test');
var buildPath = path.join(buildRoot, 'vsoxplat');
var packagePath = path.join(packageRoot, 'vsoxplat');
var binPath = path.join(buildPath, 'bin');
var agentPath = path.join(buildPath, 'agent');
var handlerPath = path.join(agentPath, 'handlers');
var pluginPath = path.join(agentPath, 'plugins');
var buildPluginPath = path.join(pluginPath, 'build');
var buildPluginLibPath = path.join(buildPluginPath, 'lib');
var scmLibPath = path.join(agentPath, 'scm', 'lib');

var mopts = {
  boolean: 'ci',
  string: 'suite',
  default: { ci: false, suite: '*' }
};

var options = minimist(process.argv.slice(2), mopts);

gulp.task('copy', ['clean'], function () {
	return merge([
		gulp.src(['admin/publish.sh']).pipe(gulp.dest(packageRoot)),
		gulp.src(['admin/dev.sh']).pipe(gulp.dest(packageRoot)),
		gulp.src(['package.json']).pipe(gulp.dest(buildPath)),
		gulp.src(['src/agent/svc.sh']).pipe(gulp.dest(agentPath)),
	    gulp.src(['src/agent/plugins/build/lib/askpass.js']).pipe(gulp.dest(buildPluginLibPath)),
	    gulp.src(['src/agent/scm/lib/credhelper.js']).pipe(gulp.dest(scmLibPath)),
	    gulp.src(['src/agent/scm/lib/gitw.js']).pipe(gulp.dest(scmLibPath)),
		gulp.src(['src/bin/install.js']).pipe(gulp.dest(binPath))
	]);			
});

gulp.task('build', ['copy'], function () {
	return gulp.src(['src/**/*.ts'])
		.pipe(typescript())
		.pipe(gulp.dest(buildPath));
});

gulp.task('testPrep', function () {
	var buildSrc = gulp.src([path.join(buildPath, '**')]);
	var testSrcPaths = ['src/test/messages/**',
						'src/test/projects/**',
						'src/test/tasks/**',
						'src/test/scripts/**',
						'src/test/testresults/**', 
						'src/vso-task-lib/**', 
						'!src/test/definitions'];
	
	return merge([
		buildSrc.pipe(gulp.dest(testRoot)),
		gulp.src(testSrcPaths, { base: 'src/test' })
			.pipe(gulp.dest(testPath))
	]);
});

gulp.task('test', ['testPrep'], function () {
	var suitePath = path.join(testPath, '*.js');
	if (options.suite !== '*') {
		suitePath = path.join(testPath, options.suite + '.js');
	}

	return gulp.src([suitePath])
		.pipe(mocha({ reporter: 'spec', ui: 'bdd', useColors: !options.ci }));
});

gulp.task('package', ['build'], function () {
	return gulp.src([path.join(buildPath, '**'), 'README.md'])
		.pipe(gulp.dest(packagePath));
});

gulp.task('tar', ['package'], function () {
	return gulp.src(path.join(packagePath, '**'))
        .pipe(tar('vsoxplat.tar'))
        .pipe(gzip())
        .pipe(gulp.dest(tarRoot));
});

gulp.task('clean', function (done) {
	del([buildRoot, tarRoot, packageRoot, testRoot], done);
});

gulp.task('default', ['tar']);
