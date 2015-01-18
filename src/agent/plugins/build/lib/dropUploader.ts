import path = require('path');
import fs = require('fs');
import zlib = require('zlib');
import stream = require('stream');
import crypto = require('crypto');
import Q = require("q");
import shell = require("shelljs");
import ctxm = require('../../../context');
import cm = require('../../../common');
import ifm = require('../../../api/interfaces');
import webapi = require("../../../api/webapi");
import tm = require('../../../tracing');
var uuid = require('node-uuid');
var util = require('util');

var _temp: string;
var _ctx: ctxm.ExecutionContext;
var _containerId: number;
var _stagingFolder: string;
var _containerRoot: string;

var _trace: tm.Tracing;

function _ensureTracing(ctx: ctxm.ExecutionContext, area: string) {
    _trace = new tm.Tracing(__filename, ctx.agentCtx);
    _trace.enter(area);
}

export function uploadFiles(ctx: ctxm.ExecutionContext, 
	                        stagingFolder:string, 
	                        containerId: number, 
	                        containerRoot: string,
	                        filePaths: string[]) {
	_ctx = ctx;
	_ensureTracing(_ctx, 'uploadFiles');

	_stagingFolder = stagingFolder;
	_containerId = containerId;
	_containerRoot = containerRoot;

	_ensureTemp(ctx.workingDirectory);

	return _uploadFiles(filePaths)
	.then(() => {
		shell.rm('-rf', _temp)
	});	
}

function _ensureTemp(workingFolder: string) {
	_ensureTracing(_ctx, 'ensureTemp');

	_temp = path.join(workingFolder, 'tmp');
	if (shell.test('-d', _temp)) {
		shell.rm('-rf', _temp)
	}

	shell.mkdir('-p', _temp);
}

var NullStream = function() {
	stream.Writable.call(this, { objectMode: true });
	this._write = function(data, encoding, callback) {}	
}
util.inherits(NullStream, stream.Writable);

function _getFileSize(filePath): Q.Promise<number> {
	_ensureTracing(_ctx, '_getFileSize');
	_trace.write(filePath);

	var defer = Q.defer<number>();

	var length = 0;


	var inputStream = fs.createReadStream(filePath);
	// fs.stat is reading 0 on some smaller gz files - let's count bytes for now
	var countStream = new NullStream();

	inputStream.on('end', () => {	
		_trace.write('end size: ' + length);
		defer.resolve(length);
	});

	inputStream.on('data', (chunk) => {
		length += chunk.length;
	});

	inputStream.pipe(countStream);

	return defer.promise;
}

//
// TODO: change upload api to use itemPath query string param
//
function _zipToTemp(filePath): Q.Promise<string> {
	_ensureTracing(_ctx, '_zipToTemp');

	var defer = Q.defer<string>();

	try
	{
		var gzip = zlib.createGzip();
		var inputStream = fs.createReadStream(filePath);
		var zipDest = path.join(_temp, uuid.v1() + '.gz');
		var ws = fs.createWriteStream(zipDest);
		_trace.write('ws for: ' + zipDest);

		inputStream.on('end', () => {			
			defer.resolve(zipDest);
		});

		inputStream.on('error', (err) => {
			defer.reject(err);
		});

		ws.on('error', (err) => {
			defer.reject(err);
		});

		inputStream.pipe(gzip).pipe(ws);		
	}
	catch (err) {
		defer.reject(err);
	}

	return defer.promise;
}

function _uploadFile(filePath) {
	_ensureTracing(_ctx, '_uploadFile');

	var info = <any>{};

	return _zipToTemp(filePath)
	.then((zipPath) => {
		_trace.state('zipPath', zipPath);

		info.zipPath = zipPath;
		return _getFileSize(zipPath);
	})
	.then((size) => {
		_trace.state('zipSize', size);

		info.zipSize = size;
		console.log(info.zipPath + ':' + info.zipSize);
		return _getFileSize(filePath);
	})
	.then((size) => {
		_trace.state('size', size);

		info.size = size;
		console.log(filePath + ':' + size);

		var containerPath = path.join(_containerRoot, filePath.substring(_stagingFolder.length + 1));
		_trace.state('containerPath', containerPath);
		_ctx.info(containerPath);

	    return _ctx.feedback.uploadFileToContainer(_containerId, {
	        fullPath: info.zipPath,
	        containerItem: {
	            containerId: _containerId,
	            itemType: ifm.ContainerItemType.File,
	            path: containerPath
	        },
	        compressedLength: info.zipSize,
	        uncompressedLength: info.size,
	        isGzipped: true
	    });
	})
}

var _uploadFiles = function(files) {
	_ensureTracing(_ctx, '_uploadFiles');

	var result = Q(null); // empty promise
	files.forEach(function(f) {
		result = result.then(function() { 
			return _uploadFile(f);
		});	
	})

	return result;	
}

