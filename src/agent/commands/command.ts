import ctxm = require('../context');
import cm = require('../common');
import Q = require('q');

export class TaskCommand implements cm.ITaskCommand {
    constructor(command: string, properties: { [name: string]: string }, message: string) {
        this.command = command;
        this.properties = properties;
        this.message = message;
        this.lines = [];
    }

	public lines: string[];
    public command: string;
    public properties: { [name: string]: string };
    public message: string;

    public info(message: string) {
    	this.lines.push(message);
    }

    public warning(message: string) {
    	this.lines.push('[warning]' + message);
    }

    public error(message: string) {
    	this.lines.push('[error]' + message);
    }
}