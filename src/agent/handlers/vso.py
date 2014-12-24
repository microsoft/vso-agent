# Copyright (c) Microsoft. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

import sys, json, os, subprocess

ctx=None
for line in sys.stdin:
  ctx = json.loads(line)

def run(args, rcFail=True, stderrFail=True):
    #rc=subprocess.check_call(args)
    redir=sys.stdout
    if stderrFail:
        redir=sys.stderr

    child=subprocess.Popen(args, stderr=redir);
    rc=child.wait()

    if rc>0 and rcFail:
        raise Exception('rc', rc);

    return rc

def info(msg):
    print ('[INFO] ' + msg)

def verbose(msg):
    print ('[VERBOSE] ' + msg)
    