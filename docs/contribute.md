# Contribute to the Microsoft Cross Platform Build Agent

In order to contribute, you will need to be able to build the source, deploy to test and run automated tests.
Please fork and send pull requests.

## Building From Source

### Clone the repo
```bash
git clone https://github.com/Microsoft/vso-agent.git
```

### Build Pre-reqs

Gulp is the build engine.  The cli needs to be installed globally
```bash
sudo npm install -g gulp
```
Install remaining pre-reqs and gulp tasks (run from root of repo)
```bash
sudo npm install
```

### Build
run gulp in the root of the repo
```bash
$ gulp
...
[22:58:35] Finished 'default' after 2.39 s
```

This creates a _package which is what is pushed to npm. 

## Install from _package

This installs from a local package instead of pulling from npm.

Create a directory for your agent and run the getagent.sh script from the _package directory you built.

```bash
~/Testing$ mkdir test && cd test
~/Testing/test3$ ~/Projects/vso-agent/_package/vsoxplat/getagent.sh 

Your output should look [similar to this](sampleoutput.md)
```