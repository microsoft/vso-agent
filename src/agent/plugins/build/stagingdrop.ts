// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="../../definitions/Q.d.ts" />
/// <reference path="../../definitions/shelljs.d.ts" />

import path = require('path');
import fs = require('fs');
import zlib = require('zlib');
import stream = require('stream');
import crypto = require('crypto');
import Q = require("q");
import shelljs = require("shelljs");
import ctxm = require('../../context');
import ifm = require('../../api/interfaces');
import buildApi = require("./buildapi");
import fileContainerApi = require("./filecontainerapi");
import basicm = require('../../api/basiccreds');

var stagingOptionId: string = "82f9a3e8-3930-482e-ac62-ae3276f284d5";
var dropOptionId: string = "e8b30f6f-039d-4d34-969c-449bbe9c3b9e";

/*
exports.pluginName = function () {
    return "buildDrop";
}

// what shows in progress view
exports.pluginTitle = function () {
	return "Copying files to staging folder"
}
*/

exports.afterJob = function (ctx: ctxm.PluginContext, callback) {
    /**
     * this plugin handles both the "copy to staging folder" and "create drop" build options
     * this way we can ensure that they happen in the correct order
     */
    if (ctx.job.environment.options) {
        var funcs = [];

        var stagingOption: ifm.JobOption = ctx.job.environment.options[stagingOptionId];
        if (stagingOption) {
            funcs.push(() => copyToStagingFolder(ctx, stagingOption));
        }

        var dropOption: ifm.JobOption = ctx.job.environment.options[dropOptionId];
        if (dropOption) {
            funcs.push(() => createDrop(ctx, stagingOption, dropOption));
        }

        funcs.reduce(Q.when, Q(null))
            .then(() => {
                callback();
            }, (err) => {
                // this will be called if anything in funcs fails
                callback(err);
            });
    }
    else {
        callback();
    }
}

exports.shouldRun = function (jobSuccess: boolean, ctx: ctxm.JobContext) {
    if (jobSuccess && !!ctx.job.environment.options) {
        return !!ctx.job.environment.options[stagingOptionId] || !!ctx.job.environment.options[dropOptionId];
    }
    else {
        return false;
    }
}

function copyToStagingFolder(ctx: ctxm.PluginContext, stagingOption: ifm.JobOption): Q.IPromise<any> {
    // determine root: $(build.sourcesdirectory)
    ctx.info("looking for source in " + ctxm.WellKnownVariables.sourceFolder);
    var sourcesRoot: string = ctx.job.environment.variables[ctxm.WellKnownVariables.sourceFolder].replaceVars(ctx.job.environment.variables);

    var stagingFolder = getStagingFolder(ctx, stagingOption);

    var searchPattern = stagingOption.data["pattern"];
    if (searchPattern) {
        // root the search pattern
        searchPattern = searchPattern.replaceVars(ctx.job.environment.variables);
        if (!isPathRooted(searchPattern) && sourcesRoot) {
            searchPattern = path.join(sourcesRoot, searchPattern);
        }

        // get list of files to copy
        var filesPromise: Q.IPromise<string[]>;
        if (searchPattern.indexOf('*') > -1 || searchPattern.indexOf('?') > -1) {
            ctx.info("Pattern found in pattern parameter.");
            filesPromise = findMatchingFiles(ctx, null, searchPattern, false, true);
        }
        else {
            filesPromise = Q([searchPattern]);
        }

        // create the staging folder
        ctx.info("Creating folder " + stagingFolder);
        var createStagingFolderPromise = Q.nfcall(fs.mkdir, stagingFolder).
            then(() => {
            },
            (error) => {
                ctx.error(error);
            });

        return Q.all([filesPromise, createStagingFolderPromise])
            .then((results: any[]) => {

                var files: string[] = results[0];
                ctx.info("found " + files.length + " files");

                var commonRoot = getCommonLocalPath(files);
                var useCommonRoot = !!commonRoot;
                if (useCommonRoot) {
                    ctx.info("There is a common root (" + commonRoot + ") for the files. Using the remaining path elements in staging folder.");
                }

                files.forEach((file: string) => {
                    var targetPath = stagingFolder;
                    if (useCommonRoot) {
                        var relativePath = file.substring(commonRoot.length)
                            .replace(/^\\/g, "")
                            .replace(/^\//g, "");
                        targetPath = path.join(stagingFolder, relativePath);
                    }

                    ctx.info("Copying all files from " + file + " to " + targetPath);

                    shelljs.cp("-Rf", path.join(file, "*"), targetPath);
                });
            });
    }
    else {
        ctx.warning("No pattern specified. Nothing to copy.");
        return Q(null);
    }
}

function createDrop(ctx: ctxm.PluginContext, stagingOption: ifm.JobOption, dropOption: ifm.JobOption): Q.IPromise<any> {
    var location = dropOption.data["location"];
    var path = dropOption.data["path"];
    var stagingFolder = getStagingFolder(ctx, stagingOption);

    if (location) {
        location = location.replaceVars(ctx.job.environment.variables);
    }
    if (path) {
        path = path.replaceVars(ctx.job.environment.variables);
    }

    ctx.info("drop location = " + location);
    ctx.info("drop path = " + path);

    // determine drop provider
    var dropPromise: Q.IPromise<string> = Q(null);
    switch (location) {
        case "filecontainer":
            dropPromise = copyToFileContainer(ctx, stagingFolder, path);
            break;
        case "uncpath":
            dropPromise = copyToUncPath(ctx, stagingFolder, path);
            break;
    }

    return dropPromise.then((artifactLocation: string) => {
        if (artifactLocation) {
            var buildClient = new buildApi.BuildApi(ctx.job.authorization.serverUrl,
                new basicm.BasicCredentialHandler(ctx.agentCtx.config.creds.username, ctx.agentCtx.config.creds.password));

            return buildClient.postArtifact(parseInt(ctx.variables[ctxm.WellKnownVariables.buildId]), {
                name: "drop",
                resource: {
                    data: artifactLocation
                }
            });
        }
        else {
            ctx.warning("Drop location/path is missing or not supported. Not creating a build drop artifact.");
            return Q(null);
        }
    });
}

function getStagingFolder(ctx: ctxm.PluginContext, stagingOption: ifm.JobOption): string {
    // determine staging folder: $(build.stagingdirectory)[/{stagingfolder}]
    ctx.info("looking for staging folder in " + ctxm.WellKnownVariables.stagingFolder);
    var stagingFolder = ctx.job.environment.variables[ctxm.WellKnownVariables.stagingFolder].replaceVars(ctx.job.environment.variables)

    if (stagingOption) {
        var relativeStagingPath = stagingOption.data["stagingfolder"];
        if (relativeStagingPath) {
            stagingFolder = path.join(stagingFolder, relativeStagingPath.replaceVars(ctx.job.environment.variables));
        }
    }

    return stagingFolder;
}

interface ContainerItemInfo {
    fullPath: string;
    containerItem?: fileContainerApi.FileContainerItem;
    contentIdentifier?: Buffer;
    compressedLength?: number;
    uncompressedLength?: number;
    isGzipped: boolean;
}

function copyToFileContainer(ctx: ctxm.PluginContext, stagingFolder: string, fileContainerPath: string): Q.IPromise<string> {
    var fileContainerRegExp = /^#\/(\d+)(\/.*)$/;
    var containerId: number;
    var containerPath: string = "/";

    var match = fileContainerPath.match(fileContainerRegExp);
    if (match) {
        containerId = parseInt(match[1]);
        if (match.length > 2) {
            containerPath = match[2];
        }
    }
    else {
        ctx.error("invalid file container path '" + fileContainerPath + "'");
        return Q(null);
    }

    var containerRoot = containerPath;
    if (containerRoot.charAt(containerPath.length) !== '/') {
        containerRoot += '/';
    }
    if (containerRoot.charAt(0) === '/') {
        containerRoot = containerRoot.substr(1);
    }

    var contentMap: { [path: string]: ContainerItemInfo; } = {}

    var fileContainerClient = new fileContainerApi.FileContainerApi(ctx.job.authorization.serverUrl,
        new basicm.BasicCredentialHandler(ctx.agentCtx.config.creds.username, ctx.agentCtx.config.creds.password));

    return readDirectory(ctx, stagingFolder, true, false)
        .then((files: string[]) => {
            return Q.all(files.map((fullPath: string) => {
                return Q.nfcall(fs.stat, fullPath)
                    .then((stat: fs.Stats) => {
                        return uploadFileToContainer(fileContainerClient, containerId, {
                            fullPath: fullPath,
                            containerItem: {
                                containerId: containerId,
                                itemType: fileContainerApi.ContainerItemType.File,
                                path: containerRoot + fullPath.substring(stagingFolder.length + 1)
                            },
                            uncompressedLength: stat.size,
                            isGzipped: false
                        });
                    });
            }))
        })
        // generate content identifiers
        /*.then((files: string[]) => {
            // TODO: process files in batches of up to 1000
            var promises: Q.IPromise<ContainerItemInfo>[] = [];

            for (var fileIndex: number = 0; fileIndex < files.length; fileIndex++) {
                var fullPath = files[fileIndex];
                var directory = path.dirname(fullPath);

                promises.push(calculateContentIdentifier(fullPath, true)
                    .then((info: ContainerItemInfo) => {
                        info.containerItem = {
                            containerId: containerId,
                            itemType: fileContainerApi.ContainerItemType.File,
                            path: containerRoot + fullPath.substring(stagingFolder.length + 1),
                            contentId: Array.prototype.slice.call(info.contentIdentifier, 0),
                            fileLength: info.compressedLength
                        };

                        console.log("generated content id for " + fullPath);
                        console.log("added " + info.containerItem.path + " to content map");
                        contentMap[info.containerItem.path] = info;
                        return info;
                    }));
            }

            return Q.all(promises);
        })
        // query file container for duplicates
        .then((tuples: ContainerItemInfo[]) => {
            console.log("generated " + tuples.length + " content ids");
            return fileContainerClient.createItems(containerId, tuples.map((item) => item.containerItem));
        })
        // upload files
        .then((containerItems: fileContainerApi.FileContainerItem[]) => {
            console.log("created " + containerItems.length + " container items");
            return Q.all(containerItems
                .filter((item) => item.itemType === fileContainerApi.ContainerItemType.File)
                .map((item: fileContainerApi.FileContainerItem) => {
                    console.log("item.path = " + item.path);
                    var tuple = contentMap[item.path];
                    return uploadFileToContainer(fileContainerClient, containerId, tuple);
                }));
        })*/
        .then(() => {
            console.log("container items uploaded");
            return fileContainerPath;
        });
}

var PagesPerBlock = 32;
var BytesPerPage = 64 * 1024;
var BlockSize = PagesPerBlock * BytesPerPage;

function calculateContentIdentifier(fullPath: string, includesFinalBlock: boolean): Q.IPromise<ContainerItemInfo> {
    var deferred = Q.defer<ContainerItemInfo>();
    var compressedLength: number = 0;

    var rollingContentIdentifier: Buffer = new Buffer("VSO Content Identifier Seed", "ascii");
    var savedRollingIdentifier: Buffer;
    var blockIdentifier: Buffer;
    var lastBlockSize: number = 0;

    Q.nfcall(fs.stat, fullPath)
        .then((stat: fs.Stats) => {
            if (stat) {
                var compressedStream = getCompressedStream(fullPath);

                compressedStream.on("readable", () => {
                    var buffer: Buffer;
                    while (null !== (buffer = compressedStream.read(BlockSize))) {
                        lastBlockSize = buffer.length;
                        compressedLength += lastBlockSize;
                        savedRollingIdentifier = rollingContentIdentifier;
                        blockIdentifier = calculateSingleBlockIdentifier(buffer);
                        rollingContentIdentifier = calculateRollingBlockIdentifier(blockIdentifier, rollingContentIdentifier, false);
                    }
                });

                compressedStream.on("end", () => {
                    if (includesFinalBlock) {
                        rollingContentIdentifier = calculateRollingBlockIdentifier(blockIdentifier, savedRollingIdentifier, true);
                    }

                    deferred.resolve({
                        fullPath: fullPath,
                        contentIdentifier: rollingContentIdentifier,
                        compressedLength: compressedLength,
                        uncompressedLength: stat.size,
                        isGzipped: true
                    });
                });
            }
        });

    return deferred.promise;
}

function calculateSingleBlockIdentifier(buffer: Buffer): Buffer {
    var pageCounter: number = 0;
    var pageIdentifiersBuffer: Buffer = new Buffer(0);

    while (buffer.length > pageCounter * BytesPerPage) {
        var bytesToCopy = Math.min(buffer.length - (pageCounter * BytesPerPage), BytesPerPage);
        var pageBuffer = new Buffer(bytesToCopy);
        buffer.copy(pageBuffer, 0, pageCounter * BytesPerPage, (pageCounter * BytesPerPage) + bytesToCopy);

        var pageHash = calculateHash(pageBuffer);
        pageCounter++;
        pageIdentifiersBuffer = Buffer.concat([pageIdentifiersBuffer, pageHash]);
    }

    return calculateHash(pageIdentifiersBuffer);
}

function calculateRollingBlockIdentifier(currentBlockIdentifier: Buffer, previousBlockIdentifier: Buffer, isFinalBlock: boolean): Buffer {
    return calculateHash(Buffer.concat([previousBlockIdentifier, currentBlockIdentifier, new Buffer([isFinalBlock ? 1 : 0])]));
}

function calculateHash(buffer: Buffer): Buffer {
    var hashProvider = crypto.createHash("sha256");
    hashProvider.update(buffer);
    return hashProvider.digest();
}

function getCompressedStream(filename: string): stream.PassThrough {
    var gzip = zlib.createGzip();
    var inputStream = fs.createReadStream(filename);
    return inputStream.pipe(gzip);
}


function uploadFileToContainer(fileContainerClient: fileContainerApi.FileContainerApi, containerId: number, containerItemTuple: ContainerItemInfo): Q.IPromise<any> {
    var contentStream: NodeJS.ReadableStream;
    if (containerItemTuple.isGzipped) {
        contentStream = getCompressedStream(containerItemTuple.fullPath);
    }
    else {
        contentStream = fs.createReadStream(containerItemTuple.fullPath);
    }

    return fileContainerClient.uploadFile(containerId,
        containerItemTuple.containerItem.path,
        contentStream,
        containerItemTuple.contentIdentifier,
        containerItemTuple.uncompressedLength,
        containerItemTuple.compressedLength,
        containerItemTuple.isGzipped);
}

function copyToUncPath(ctx: ctxm.PluginContext, stagingFolder: string, uncPath: string): Q.IPromise<string> {
    ctx.info("Copying all files from " + stagingFolder + " to " + uncPath);

    shelljs.cp("-Rf", path.join(stagingFolder, "*"), uncPath);

    return Q(uncPath);
}

function getCommonLocalPath(files: string[]): string {
    if (!files || files.length === 0) {
        return "";
    }
    else {
        var root: string = files[0];

        for (var index = 1; index < files.length; index++) {
            root = _getCommonLocalPath(root, files[index]);
            if (!root) {
                break;
            }
        }

        return root;
    }
}

function _getCommonLocalPath(path1: string, path2: string): string {
    var path1Depth = getFolderDepth(path1);
    var path2Depth = getFolderDepth(path2);

    var shortPath: string;
    var longPath: string;
    if (path1Depth >= path2Depth) {
        shortPath = path2;
        longPath = path1;
    }
    else {
        shortPath = path1;
        longPath = path2;
    }

    while (!isSubItem(longPath, shortPath)) {
        var parentPath = path.dirname(shortPath);
        if (path.normalize(parentPath) === path.normalize(shortPath)) {
            break;
        }
        shortPath = parentPath;
    }

    return shortPath;
}

function isSubItem(item: string, parent: string): boolean {
    item = path.normalize(item);
    parent = path.normalize(parent);
    return item.substring(0, parent.length) == parent
        && (item.length == parent.length || (parent.length > 0 && parent[parent.length - 1] === path.sep) || (item[parent.length] === path.sep));
}

function getFolderDepth(fullPath: string): number {
    if (!fullPath) {
        return 0;
    }

    var current = path.normalize(fullPath);
    var parentPath = path.dirname(current);
    var count = 0;
    while (parentPath !== current) {
        ++count;
        current = parentPath;
        parentPath = path.dirname(current);
    }

    return count;
}

function findMatchingFiles(ctx: ctxm.PluginContext, rootFolder: string, pattern: string, includeFiles: boolean, includeFolders: boolean): Q.IPromise<string[]> {
    pattern = pattern.replace(';;', '\0');
    var patterns = pattern.split(';');

    var includePatterns: string[] = [];
    var excludePatterns: RegExp[] = [];

    patterns.forEach((p: string, index: number) => {
        p = p.replace('\0', ';');

        var isIncludePattern: boolean = true;
        if (p.substring(0, 2) === "+:") {
            p = p.substring(2);
        }
        else if (p.substring(0, 2) === "-:") {
            isIncludePattern = false;
            p = p.substring(2);
        }

        if (!isPathRooted(p) && rootFolder) {
            p = path.join(rootFolder, p);
        }

        if (!isValidPattern(p)) {
            // TODO: report error
            ctx.error("invalid pattern " + p);
        }

        if (isIncludePattern) {
            includePatterns.push(p);
        }
        else {
            excludePatterns.push(convertPatternToRegExp(p));
        }
    });

    return getMatchingItems(ctx, includePatterns, excludePatterns, includeFiles, includeFolders);
}

function getMatchingItems(ctx: ctxm.PluginContext, includePatterns: string[], excludePatterns: RegExp[], includeFiles: boolean, includeFolders: boolean): Q.IPromise<string[]> {
    var fileMap: any = {};

    var funcs = includePatterns.map((includePattern: string, index: number) => {
        return (files: string[]) => {
            var pathPrefix = getPathPrefix(includePattern);
            var patternRegex = convertPatternToRegExp(includePattern);

            return readDirectory(ctx, pathPrefix, includeFiles, includeFolders)
                .then((paths: string[]) => {
                    paths.forEach((path: string, index: number) => {
                        var normalizedPath = path.replace(/\\/g, '/');
                        var alternatePath = normalizedPath + "//";

                        var isMatch = false;
                        if (patternRegex.test(normalizedPath) || (includeFolders && patternRegex.test(alternatePath))) {
                            isMatch = true;
                            for (var i = 0; i < excludePatterns.length; i++) {
                                var excludePattern = excludePatterns[i];
                                if (excludePattern.test(normalizedPath) || (includeFolders && excludePattern.test(alternatePath))) {
                                    isMatch = false;
                                    break;
                                }
                            }
                        }

                        if (isMatch && !fileMap[path]) {
                            fileMap[path] = true;
                            files.push(path);
                        }
                    });

                    return files;
                });
        }
    });

    return funcs.reduce(Q.when, Q([]));
}

function readDirectory(ctx: ctxm.PluginContext, directory: string, includeFiles: boolean, includeFolders: boolean): Q.IPromise<string[]> {
    var results: string[] = [];
    var deferred = Q.defer<string[]>();

    if (includeFolders) {
        results.push(directory);
    }

    Q.nfcall(fs.readdir, directory)
        .then((files: string[]) => {
            var count = files.length;
            if (count > 0) {
                files.forEach((file: string, index: number) => {
                    var fullPath = path.join(directory, file);
                    Q.nfcall(fs.stat, fullPath)
                        .then((stat: fs.Stats) => {
                            if (stat && stat.isDirectory()) {
                                readDirectory(ctx, fullPath, includeFiles, includeFolders)
                                    .then((moreFiles: string[]) => {
                                        results = results.concat(moreFiles);
                                        if (--count === 0) {
                                            deferred.resolve(results);
                                        }
                                    },
                                    (error) => {
                                        ctx.error(error.toString());
                                    });
                            }
                            else {
                                if (includeFiles) {
                                    results.push(fullPath);
                                }
                                if (--count === 0) {
                                    deferred.resolve(results);
                                }
                            }
                        });
                });
            }
            else {
                deferred.resolve(results);
            }
        },
        (error) => {
            ctx.error(error.toString());
        });

    return deferred.promise;
}

function getPathPrefix(pattern: string): string {
    var starIndex = pattern.indexOf('*');
    var questionIndex = pattern.indexOf('?');

    var index: number;
    if (starIndex > -1 && questionIndex > -1) {
        index = Math.min(starIndex, questionIndex);
    }
    else {
        index = Math.max(starIndex, questionIndex);
    }

    if (index < 0) {
        return path.dirname(pattern);
    }
    else {
        return pattern.substring(0, index);
    }
}

function isPathRooted(filePath: string): boolean {
    if (filePath.substring(0, 2) === "\\\\") {
        return true;
    }
    else if (filePath.charAt(0) === "/") {
        return true;
    }
    else {
        var regex = /^[a-zA-Z]:/;
        return regex.test(filePath);
    }
}

function isValidPattern(pattern: string): boolean {
    if (pattern.length > 0 && pattern.charAt(pattern.length - 1) === "\\" || pattern.charAt(pattern.length - 1) === "/") {
        return false;
    }
    else {
        return true;
    }
}

function convertPatternToRegExp(pattern: string): RegExp {
    pattern = pattern.replace(/\\/g, '/')
        .replace(/([.?*+^$[\]\\(){}|-])/g, "$1")
        .replace(/\/\*\*\//g, "((/.+/)|(/))")
        .replace(/\*\*/g, ".*")
        .replace("*", "[^/]*")
        .replace(/\?/g, ".");
    return new RegExp('^' + pattern + '$', "i");
}