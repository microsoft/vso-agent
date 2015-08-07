import path = require('path');
import fs = require('fs');
import zlib = require('zlib');
import stream = require('stream');
import crypto = require('crypto');
import Q = require("q");
import shell = require("shelljs");
import ctxm = require('../../../context');
import cm = require('../../../common');
import fchelperm = require('../../../filecontainerhelper');
import fcifm = require('vso-node-api/interfaces/FileContainerInterfaces');
import ifm = require('../../../api/interfaces');
import webapi = require("../../../api/webapi");
import tm = require('../../../tracing');
var uuid = require('node-uuid');

var _temp: string;
var _ctx: ctxm.ExecutionContext;
var _containerId: number;
var _stagingFolder: string;
var _containerRoot: string;

var _trace: tm.Tracing;

function _ensureTracing(ctx: ctxm.ExecutionContext, area: string) {
    _trace = new tm.Tracing(__filename, ctx.workerCtx);
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

function _getFileSize(filePath): Q.Promise<number> {
	_ensureTracing(_ctx, '_getFileSize');
	_trace.write('fileSize for: ' + filePath);

    var defer = Q.defer<number>();

    var l = 0;
    var rs = fs.createReadStream(filePath);
    rs.on('readable', function() {
      var chunk;
      
      while (null !== (chunk = rs.read())) {
        l += chunk.length;
      }
    });

    rs.on('end', function() {
    	_trace.write('end size: ' + l);
        defer.resolve(l);       
    });

    rs.on('error', function(err) {
    	_trace.error('_getFileSize error! - ' + filePath);
        defer.reject(err);        
    });

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

        gzip.on('end', function () {
            defer.resolve(zipDest);
        });

        gzip.on('error', function (err) {
            defer.reject(err);
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

function _uploadZip(filePath: string, fileSize: number, containerPath: string) {
	_ensureTracing(_ctx, '_uploadZip');
	var info = <any>{};

	return _zipToTemp(filePath)
	.then((zipPath) => {
		info.zipPath = zipPath;
		return _getFileSize(zipPath);
	})
	.then((zipSize) => {
		_trace.write(info.zipPath + ':' + zipSize);

		var item: ifm.FileContainerItemInfo =  <ifm.FileContainerItemInfo>{
	        fullPath: info.zipPath,
	        containerItem: <fcifm.FileContainerItem>{
	            containerId: _containerId,
	            itemType: fcifm.ContainerItemType.File,
	            path: containerPath
	        },
			uploadHeaders: fchelperm.getUploadHeaders(true, fileSize, zipSize)
	    };
	    _trace.state('item', item);

		return _ctx.service.uploadFileToContainer(_containerId, item);
	})
}

function _uploadFile(filePath) {
	_ensureTracing(_ctx, '_uploadFile');

	var info = <any>{};
	var containerPath = path.join(_containerRoot, filePath.substring(_stagingFolder.length + 1));
	_ctx.info(containerPath);
	_trace.state('containerPath', containerPath);

	return _getFileSize(filePath)
	.then ((size) => {
		info.originalSize = size;

		if (size > (65 * 1024)) {
			return _uploadZip(filePath, size, containerPath);
		}
		else {
			var item: ifm.FileContainerItemInfo = <ifm.FileContainerItemInfo>{
		        fullPath: filePath,
		        containerItem: <fcifm.FileContainerItem>{
		            containerId: _containerId,
		            itemType: fcifm.ContainerItemType.File,
		            path: containerPath
		        },
				uploadHeaders: fchelperm.getUploadHeaders(false, size)
		    };

		    _trace.state('item', item);
			return _ctx.service.uploadFileToContainer(_containerId, item);			
		}
	})
}

var _uploadFiles = function(files) {
	_ensureTracing(_ctx, '_uploadFiles');

	var result = Q(null); // empty promise
	files.forEach(function(f) {
		result = result.then(function() { 
			return _uploadFile(f);
		})	
	})

	return result;	
}

