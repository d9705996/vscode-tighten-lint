"use strict";

import * as vscode from "vscode";
import * as cp from "child_process";

export default class LintProvider {

    private diagnostics: vscode.DiagnosticCollection;
    private config: vscode.WorkspaceConfiguration;
    private outputChannel: vscode.OutputChannel;

    public constructor() {
        this.diagnostics = vscode.languages.createDiagnosticCollection();
        this.config = vscode.workspace.getConfiguration("tighten-lint");
        this.outputChannel = vscode.window.createOutputChannel('Tighten Lint');
    }

    public activate(subscriptions: vscode.Disposable[]) {

        if (vscode.window.activeTextEditor) {
            this.check(vscode.window.activeTextEditor.document);
        }
        vscode.workspace.onDidCloseTextDocument(
            textDocument => {
                this.diagnostics.delete(textDocument.uri);
            },
            null,
            subscriptions
        );

        vscode.workspace.onDidOpenTextDocument(this.check, this);
        vscode.workspace.onDidSaveTextDocument(this.check, this);

        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                this.check(editor.document);
            }
        });

        vscode.workspace.onDidCloseTextDocument(
            textDocument => {
                this.diagnostics.delete(textDocument.uri);
            },
            null,
            subscriptions
        );
    }

    private check(textDocument: vscode.TextDocument) {
        if (textDocument.uri.scheme !== "file") {
            return;
        }
        if (textDocument.languageId !== "php") {
            return;
        }
        this.config = vscode.workspace.getConfiguration("tighten-lint");

        let command: string = this.config.exec + ' lint --json ' + this.getIncludedPolicies() + ' ' + textDocument.fileName;

        this.outputChannel.appendLine("Executing: " + command);
        cp.exec(command, (error, stdout: string) => {
            if (error) {
                this.outputChannel.appendLine(error.message);
                return;
            }

            this.outputChannel.appendLine(stdout);

            this.diagnostics.set(
                textDocument.uri,
                this.getDiagnostics(stdout)
            );
        });
    }

    private getDiagnostics(decoded: string): vscode.Diagnostic[] {
        let diagnostics: vscode.Diagnostic[] = [];

        if (!this.IsJsonString(decoded)) {
            return diagnostics;
        }
        let errors = JSON.parse(decoded);

        errors.errors.forEach((element) => {
            diagnostics.push(new vscode.Diagnostic(
                new vscode.Range(
                    new vscode.Position(element.line - 1, 0),
                    new vscode.Position(element.line - 1, Number.MAX_VALUE)
                ),
                `tighten-lint: ${element.message} (${element.source})`,
                this.getSeverity(element.source)
            ));
        });

        return diagnostics;
    }

    private getSeverity(source: string): vscode.DiagnosticSeverity {

        let severity = this.config.severities.hasOwnProperty(source) ? this.config.severities[source] : this.config.defaultSeverity;
        switch (severity) {
            case "hint":
                return vscode.DiagnosticSeverity.Hint;
            case "info":
                return vscode.DiagnosticSeverity.Information;
            case "warning":
                return vscode.DiagnosticSeverity.Warning;
            default:
                return vscode.DiagnosticSeverity.Error;
        }
    }

    private getIncludedPolicies(): string {
        let policies = [];
        this.config.only.forEach(policy => {
            policies.push("--only");
            policies.push(policy);
        });
        return policies.join(" ");
    }

    private IsJsonString(str: string): boolean {
        try {
            JSON.parse(str);
        } catch (e) {
            return false;
        }
        return true;
    }
}