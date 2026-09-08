
import { Node } from "node-red";
import { BaseNode, InputConfig, JsonUtil, NodeDescription, NodeManager, onInput, SourceUtility } from "@theotherwillembotha/node-red-plugincore";
import { LoggerTemplate, Log, Logger, LoggerTemplateConfig } from "@theotherwillembotha/node-red-plugincore";
import { Metrics, MetricsTemplateConfig, MetricType, CounterMetric, MetricsTemplate } from "@theotherwillembotha/node-red-plugincore";

import { ZookeeperServerConfigNode } from "./ZookeeperServerConfigNode";
import { ZookeeperClient, ZookeeperClientState } from "../service/ZookeeperService";

interface ZookeeperReadNodeConfig extends MetricsTemplateConfig, LoggerTemplateConfig, InputConfig {
    serverconfig: string;
    nodepath: string;
    nodepath_type: string;
    outputPath: string;
    outputPath_type: string;
    returnEmptyValues: boolean;
}

@NodeDescription({
    id:"ZookeeperReadNode",
    name:"Zookeeper Read Node",
    group:"zookeeper",
    sourceFile:SourceUtility.getSourcePath("/build/", "/src/") + "ZookeeperReadNode.html",
    package: "@theotherwillembotha/node-red-zookeeper",
    templates: [
        { template: LoggerTemplate, config: {}},
        { template: MetricsTemplate, config: {}}
    ],
    dependencies:[ ZookeeperServerConfigNode ],
    tags: [ "Zookeeper" ]
})
export class ZookeeperReadNode extends BaseNode<ZookeeperReadNodeConfig> {

    @Logger("ZookeeperEventNode")
    private log!:Log;

    @Metrics({name:"events", description:"A Counter for the number of read node messages", type:MetricType.Counter })
    private _counter!: CounterMetric;

    private _client: ZookeeperClient;
    private _statusListener: (state: ZookeeperClientState) => void;

    constructor(node: Node, config: ZookeeperReadNodeConfig){
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
    }

    @onInput()
    protected onInput(message:Object, errorHandler:Function){
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

                this._client.readNode(path)
                .then(data => {
                    // data is null when the path does not exist in ZooKeeper
                    if(data === null) {
                        if(this.config().returnEmptyValues) {
                            this.log.log({path, data: null});
                            this.node().send([message as any]);
                        }
                        return;
                    }

                    this._counter.inc();
                    let bufferData = data.toString();
                    let value: any;
                    try {
                        value = JSON.parse(bufferData);
                    } catch(error) {
                        value = bufferData;
                    }

                    this.log.log({path, data: value});

                    const outputType = this.config().outputPath_type || 'msg';
                    const outputPath = this.config().outputPath;
                    if (outputType === 'flow') {
                        this.node().context().flow.set(outputPath, value);
                    } else if (outputType === 'global') {
                        this.node().context().global.set(outputPath, value);
                    } else {
                        JsonUtil.jsonUpdate(message, outputPath, value);
                    }

                    this.node().send([message as any]);
                });
            }
        );
    }
}

