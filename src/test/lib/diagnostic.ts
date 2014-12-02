// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

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