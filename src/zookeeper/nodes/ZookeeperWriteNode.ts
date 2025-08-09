
import { Node } from "node-red";
import { BaseNode, InputConfig, NodeDescription, NodeManager, onInput, SourceUtility } from "@theotherwillembotha/node-red-plugincore";
import { LoggerTemplate, Log, Logger, LoggerTemplateConfig } from "@theotherwillembotha/node-red-plugincore";
import { Metrics, MetricsTemplateConfig, MetricType, CounterMetric, MetricsTemplate } from "@theotherwillembotha/node-red-plugincore";

import { ZookeeperServerConfigNode } from "./ZookeeperServerConfigNode";
import Handlebars from "handlebars";
import { ZookeeperClient, ZookeeperClientState } from "../services/ZookeeperService";

Handlebars.registerHelper('json', function(context) {
    return JSON.stringify(context);
});

interface ZookeeperWriteNodeConfig extends MetricsTemplateConfig, LoggerTemplateConfig, InputConfig {
    serverconfig: string;
    nodepath: string;
    nodepath_type: string;
    payloadTemplate: string;
}

@NodeDescription({
    id:"ZookeeperWriteNode",
    name:"Zookeeper Write Node",
    group:"zookeeper",
    sourceFile:SourceUtility.getSourcePath("/build/", "/src/") + "ZookeeperWriteNode.html",
    package: "@theotherwillembotha/nodered_pluginzookeeper",
    templates: [
        { template: LoggerTemplate, config: {}},
        { template: MetricsTemplate, config: {}}
    ],
    dependencies:[ ZookeeperServerConfigNode ],
    tags: [ "Zookeeper" ]
})
export class ZookeeperWriteNode extends BaseNode<ZookeeperWriteNodeConfig> {

    @Logger("ZookeeperEventNode")
    private log!:Log;

    @Metrics({name:"events", description:"A Counter for the number of written nodes", type:MetricType.Counter })
    private _counter!: CounterMetric;

    private _client: ZookeeperClient;
    private _statusListener: (state: ZookeeperClientState) => void;
    private dataTemplate: HandlebarsTemplateDelegate<any>;

    constructor(node: Node, config: ZookeeperWriteNodeConfig){
        super(node, config);
        let _this = this;

        // get a referecne to the zookeeper client.
        this._client = (NodeManager.RED.nodes.getNode(config.serverconfig) as any).node().client();

        this._statusListener = (state:ZookeeperClientState) => {
            if(state === ZookeeperClientState.Connected){
                _this.node().status({fill:"green",shape:"dot",text:"Connected"});
            }
            if(state === ZookeeperClientState.Disconnected){
                _this.node().status({fill:"red",shape:"dot",text:"Disconnected"});
            }
        }
        this._client.addStatusListener(this._statusListener);

        this.dataTemplate = Handlebars.compile(config.payloadTemplate);
    }

    @onInput()
    protected onInput(message:Object, errorHandler:Function){
        let data = this.dataTemplate({msg:message});

        NodeManager.RED.util.evaluateNodeProperty(
            this.config().nodepath,
            this.config().nodepath_type || 'str',
            this.node(),
            message as any,
            (err: any, path: string) => {
                if (err || !path) {
                    errorHandler(err || new Error("Could not resolve node path"));
                    return;
                }

                this._client.writeNode(path, data)
                .then(() => {
                    this.log.log({path, msg: data});
                    this._counter.inc();
                    this.node().send([message as any]);
                });
            }
        );
    }
}

