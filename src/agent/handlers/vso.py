# 
# Copyright (c) Microsoft and contributors.  All rights reserved.
# 
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#   http://www.apache.org/licenses/LICENSE-2.0
# 
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# 
# See the License for the specific language governing permissions and
# limitations under the License.
# 

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
	