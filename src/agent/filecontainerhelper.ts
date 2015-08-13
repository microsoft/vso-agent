import Q = require('q');
import utils = require('./utilities');
import path = require('path');
import shell = require("shelljs");
import fs = require('fs');
import ctxm = require('context');
import zlib = require('zlib');
import fcifm = require('vso-node-api/interfaces/FileContainerInterfaces');
import ifm = require('./api/interfaces');
var uuid = require('node-uuid');

export function copyToFileContainer(taskCtx: ctxm.TaskContext, localPath: string, containerId: number, containerFolder: string): Q.Promise<string> {
	var fc = new FileContainerHelper(taskCtx);
	return fc.copyToFileContainer(localPath, containerId, containerFolder);
}

export function getUploadHeaders(isGzipped: boolean, 
	uncompressedLength: number, 
	compressedLength?: number, 
	contentIdentifier?: Buffer): { [header: string]: any; } {

    var addtlHeaders: { [header: string]: any; } = {};
    var byteLengthToSend = isGzipped ? compressedLength : uncompressedLength;

    addtlHeaders["Content-Range"] = "bytes 0-" + (byteLengthToSend - 1) + "/" + byteLengthToSend;
    addtlHeaders["Content-Length"] = byteLengthToSend;

    if (isGzipped) {
        addtlHeaders["Accept-Encoding"] = "gzip";
        addtlHeaders["Content-Encoding"] = "gzip";
        addtlHeaders["x-tfs-filelength"] = uncompressedLength;
    }

    if (contentIdentifier) {
        addtlHeaders["x-vso-contentId"] = contentIdentifier.toString("base64");
    }
	return addtlHeaders;
}

export class FileContainerHelper {	
	private _taskCtx: ctxm.TaskContext;
	private _tempFolder: string;
	
	constructor(taskCtx: ctxm.TaskContext) {
		this._taskCtx = taskCtx;
	}
	
	public copyToFileContainer(localPath: string, containerId: number, containerFolder: string): Q.Promise<string> {
		this._taskCtx.verbose("copyToFileContainer(" + localPath + ", " + containerId + ", " + containerFolder + ")");
        return utils.readDirectory(localPath, true, false)
            .then((files: string[]) => {
				this._taskCtx.verbose("found " + files.length + " files");
                return this._uploadFiles(localPath, containerId, containerFolder, files);
            })
            .then(() => {
                return '#/' + containerId + containerFolder;
            });
    }
	
	private _uploadFiles(localPath: string, containerId: number, containerRoot: string, filePaths: string[]): Q.Promise<any> {
		var tempFolder = this._ensureTemp(this._taskCtx.workingDirectory);
		
		var fileUploadPromise = Q(null); // empty promise
		filePaths.forEach((filePath: string) => {
			fileUploadPromise = fileUploadPromise.then(() => {
				return this._uploadFile(filePath, localPath, tempFolder, containerId, containerRoot);
			})
		});
		
		return fileUploadPromise.then(() => {
			shell.rm('-rf', tempFolder);
		});	
	}
	
	private _ensureTemp(workingFolder: string): string {
		var tempFolder = path.join(workingFolder, 'tmp');
		if (shell.test('-d', tempFolder)) {
			shell.rm('-rf', tempFolder)
		}
	
		shell.mkdir('-p', tempFolder);
		return tempFolder;
	}
	
	private _getFileSize(filePath: string): Q.Promise<number> {
		this._taskCtx.verbose('fileSize for: ' + filePath);
	
	    var defer = Q.defer<number>();
	
	    var l = 0;
	    var rs = fs.createReadStream(filePath);
	    rs.on('readable', () => {
			var chunk;
	      
			while (null !== (chunk = rs.read())) {
				l += chunk.length;
			}
	    });
	
	    rs.on('end', () => {
	    	this._taskCtx.verbose('end size: ' + l);
	        defer.resolve(l);       
	    });
	
	    rs.on('error', (err) => {
	    	this._taskCtx.error('_getFileSize error! - ' + filePath);
	        defer.reject(err);        
	    });
	
	    return defer.promise;
	}
	
	private _uploadFile(filePath: string, rootFolder: string, tempFolder: string, containerId: number, containerRoot: string): Q.Promise<any> {
		var info = <any>{};
		var containerPath = path.join(containerRoot, filePath.substring(rootFolder.length + 1));
		this._taskCtx.verbose('containerPath = ' + containerPath);
	
		return this._getFileSize(filePath).then((size) => {
			info.originalSize = size;
	
			if (size > (65 * 1024)) {
				return this._uploadZip(filePath, tempFolder, size, containerId, containerPath);
			}
			else {
				var item: ifm.FileContainerItemInfo = <ifm.FileContainerItemInfo>{
					fullPath: filePath,
					uploadHeaders: getUploadHeaders(false, size),
		            containerItem: <fcifm.FileContainerItem>{
						containerId: containerId,
			            itemType: fcifm.ContainerItemType.File,
			            path: containerPath
					}
			    };
	
				return this._taskCtx.service.uploadFileToContainer(containerId, item);			
			}
		})
	}
	
	//
	// TODO: change upload api to use itemPath query string param
	//
	private _zipToTemp(filePath: string, tempFolder: string): Q.Promise<string> {
		var defer = Q.defer<string>();
	
		try
		{
			var gzip = zlib.createGzip();
			var inputStream = fs.createReadStream(filePath);
			var zipDest = path.join(tempFolder, uuid.v1() + '.gz');
			var ws = fs.createWriteStream(zipDest);
			this._taskCtx.verbose('ws for: ' + zipDest);
	
	        gzip.on('end', () => {
	            defer.resolve(zipDest);
	        });
	
	        gzip.on('error', (err) => {
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
	
	private _uploadZip(filePath: string, tempFolder: string, fileSize: number, containerId: number, containerPath: string) {
		var info = <any>{};
	
		return this._zipToTemp(filePath, tempFolder)
		.then((zipPath) => {
			info.zipPath = zipPath;
			return this._getFileSize(zipPath);
		})
		.then((zipSize) => {
			this._taskCtx.verbose(info.zipPath + ':' + zipSize);
	
			var item: ifm.FileContainerItemInfo =  <ifm.FileContainerItemInfo>{
	            fullPath: info.zipPath,
				uploadHeaders: getUploadHeaders(true, fileSize, zipSize),
				containerItem: <fcifm.FileContainerItem>{
					containerId: containerId,
		            itemType: fcifm.ContainerItemType.File,
		            path: containerPath
				}
		    };
		    
			return this._taskCtx.service.uploadFileToContainer(containerId, item);
		})
	}
}