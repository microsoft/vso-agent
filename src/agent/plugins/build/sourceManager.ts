import agentifm = require('vso-node-api/interfaces/TaskAgentInterfaces');
import shell = require('shelljs');

export class SourceManager {
    constructor(workingDirectory: string) {
        this.workingDirectory = workingDirectory;
    }

    public workingDirectory: string;

    public ensureDirectory(job: agentifm.JobRequestMessage): string {

        // only support 1
        var endpoint: agentifm.ServiceEndpoint = endpoints[0];

        var variables = job.environment.variables;

        var sys = variables[cm.sysVars.system];
        var collId = variables[cm.sysVars.collectionId];

        var defId = variables[cm.sysVars.definitionId];
        var hashInput = collId + ':' + defId + ':' + endpoint.url;

        var hashProvider = crypto.createHash("sha256");
        hashProvider.update(hashInput, 'utf8');
        var hash = hashProvider.digest('hex');

        //
        // Use old source enlistments if they already exist.  Let's not force a reclone on agent update
        // New workspaces get a shorter path
        //
        var legacyDir = path.join(this.workingDirectory, 'build', hash);
        if (shell.test('-d', legacyDir)) {
            return legacyDir;
        }

        
    }
}