"use strict";

import * as vscode from 'vscode';
import LintProvider from './providers/LintProvider';
export function activate(context: vscode.ExtensionContext) {

	let linter = new LintProvider();
	linter.activate(context.subscriptions);
}


export function deactivate() { }
