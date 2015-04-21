//
// Command Format:
//    ##vso[artifact.command key=value;key=value]user message
//    
// Examples:
//    ##vso[task.progress value=58]
//    ##vso[task.issue type=warning;]This is the user warning message
//
var TaskCommand = (function () {
    function TaskCommand(command, properties, message) {
        if (!command) {
            command = 'missing.command';
        }
        this.command = command;
        this.properties = properties;
        this.message = message;
    }
    TaskCommand.prototype.toString = function () {
        var cmdStr = '##vso[' + this.command;
        if (this.properties && Object.keys(this.properties).length > 0) {
            cmdStr += ' ';
            for (var key in this.properties) {
                if (this.properties.hasOwnProperty(key)) {
                    var val = this.properties[key];
                    if (val) {
                        cmdStr += key + '=' + val + ';';
                    }                    
                }
            }
        }
        cmdStr += ']' + this.message;
        return cmdStr;
    };
    return TaskCommand;
})();
exports.TaskCommand = TaskCommand;

function commandFromString(commandLine) {
    var preLen = cm.CMD_PREFIX.length;
    var lbPos = commandLine.indexOf('[');
    var rbPos = commandLine.indexOf(']');
    if (lbPos == -1 || rbPos == -1 || rbPos - lbPos < 3) {
        throw new Error('Invalid command brackets');
    }
    var cmdInfo = commandLine.substring(lbPos + 1, rbPos);
    var cmdParts = cmdInfo.trim().split(' ');
    var command = cmdParts[0];
    var properties = {};
    if (cmdParts.length == 2) {
        var propLines = cmdParts[1].split(';');
        propLines.forEach(function (propLine) {
            var propParts = propLine.trim().split('=');
            if (propParts.length != 2) {
                throw new Error('Invalid property: ' + propLine);
            }
            properties[propParts[0]] = propParts[1];
        });
    }
    var msg = commandLine.substring(rbPos + 1);
    var cmd = new TaskCommand(command, properties, msg);
    return cmd;
}
exports.commandFromString = commandFromString;
