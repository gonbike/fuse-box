import { File } from "../../core/File";
import { WorkFlowContext } from "../../core/WorkflowContext";
import { Plugin } from "../../core/WorkflowContext";

import * as acorn from "acorn";
import * as SourceMap from "source-map";
import { es6Import } from './replacements/ImportReplacement';
import { replaceNode } from './utils/ReplaceNode';

/**
 * @export
 * @class SourceMapPlainJsPluginClass
 * @implements {Plugin}
 */
export class FusionPluginClass implements Plugin {
	/**
	 * @type {RegExp}
	 * @memberOf SourceMapPlainJsPluginClass
	 */
    public test: RegExp = /\.js$/;
	/**
	 * @type {string}
	 * @memberOf SourceMapPlainJsPluginClass
	 */
    public ext: string = ".js";
	/**
	 * @type {WorkFlowContext}
	 * @memberOf SourceMapPlainJsPluginClass
	 */
    private context: WorkFlowContext;

    constructor(options?: any) {
        options = options || {};

        if ('test' in options) this.test = options.test;
        if ('ext' in options) this.ext = options.ext;
    }

    init(context: WorkFlowContext) {
        this.context = context;

        context.allowExtension(this.ext);
    }

    transform(file: File) {
        const tokens = [];
        file.loadContents();
        file.makeAnalysis({ onToken: tokens });
        file.sourceMap = this.getSourceMap(file, tokens);
    }

    onASTNode(file: File, node: any, parent: any) {
        if (node.type === "ImportDeclaration") {
            if (node.source && file.analysis.nodeIsString(node.source)) {
                const specifiers = [];
                node.specifiers.forEach(specifier => {
                    specifiers.push(specifier.imported.name);
                })
                const transformedAst = es6Import(specifiers, node.source.value);
                replaceNode(node, transformedAst);
                file.analysis.requiresRegeneration = true;
            }
        }
    }

    private getSourceMap(file: File, tokens: Array<any>): string {
        const fileContent = file.contents;

        const filePath = file.info.fuseBoxPath
        const smGenerator = new SourceMap.SourceMapGenerator({ file: filePath });

        tokens.some(token => {
            if (token.type.label === "eof") return true;
            const lineInfo = acorn.getLineInfo(fileContent, token.start);
            const mapping = {
                original: lineInfo,
                generated: lineInfo,
                source: filePath,
                name: false
            };

            if (token.type.label === "name") mapping.name = token.value;

            smGenerator.addMapping(mapping);
        });

        smGenerator.setSourceContent(filePath, fileContent);

        return JSON.stringify(smGenerator.toJSON());
    }
}

export const FusionPlugin = (options?: any) => {
    return new FusionPluginClass(options);
}