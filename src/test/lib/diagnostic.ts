// 
// Copyright (c) Microsoft and contributors.  All rights reserved.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// 
// See the License for the specific language governing permissions and
// limitations under the License.
// 

import cm = require('../../agent/common');

export class TestDiagnosticWriter implements cm.IDiagnosticWriter {
	constructor(level: cm.DiagnosticLevel) {
		this.level = level;
		this.messages = [];
		this.errors = [];
	}

	public level: cm.DiagnosticLevel
	private messages: string[];
	private errors: string[];

	public write(message: string): void {
		this.messages.push(message);
	}

	public writeError(message: string): void {
		this.errors.push(message);
	}

	public end(): void {
	}

	public getMessages(): string[] {
		return this.messages;
	}

	public getMessage(index: number): string {
		return this.messages[index];
	}

	public anyErrors(): boolean {
		return this.errors.length != 0;
	}
}