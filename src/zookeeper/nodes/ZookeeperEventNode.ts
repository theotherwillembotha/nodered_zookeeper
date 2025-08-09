
import { Node } from "node-red";
import { Log, BaseNode, NodeDescription, NodeManager, SourceUtility } from "@theotherwillembotha/node-red-plugincore";
import { Metrics, MetricsTemplate, MetricsTemplateConfig, MetricType, CounterMetric } from "@theotherwillembotha/node-red-plugincore";
import { LoggerTemplate, Logger, LoggerTemplateConfig,  } from "@theotherwillembotha/node-red-plugincore";
import { ZookeeperServerConfigNode } from "./ZookeeperServerConfigNode";
import { ZookeeperClient, ZookeeperClientState, ZookeeperSubscriber } from "../services/ZookeeperService";

interface ZookeeperEventNodeConfig extends MetricsTemplateConfig, LoggerTemplateConfig {
    serverconfig: string;
    subscription: string;
    getvalueonsubscribe:boolean
}

@NodeDescription({
    id:"ZookeeperEventNode",
    name:"Zookeeper Event Node",
    group:"zookeeper",
    sourceFile:SourceUtility.getSourcePath("/build/", "/src/") + "ZookeeperEventNode.html",
    package: "@theotherwillembotha/nodered_pluginzookeeper",
    templates: [
        { template: LoggerTemplate, config: {}},
        { template: MetricsTemplate, config: {}}
    ],
    dependencies:[ ZookeeperServerConfigNode ],
    tags: [ "Zookeeper" ]
})
export class ZookeeperEventNode extends BaseNode<ZookeeperEventNodeConfig> {

    @Logger("ZookeeperEventNode")
    private _log!:Log;

    @Metrics({name:"events", description:"A Counter for the number of received events", type:MetricType.Counter })
    private _counter!: CounterMetric;
    
    private _client: ZookeeperClient;
    private _statusListener: (state: ZookeeperClientState) => void;
    private _subscriber!: ZookeeperSubscriber;

    constructor(node: Node, config: ZookeeperEventNodeConfig){
        super(node, config)
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

        this._subscriber = {
            subscriptions: [config.subscription],
            getvalueonsubscribe: config.getvalueonsubscribe,
            callback:(path:string, data:Buffer<ArrayBufferLike>) => {
                this._counter.inc();
                let bufferData = data.toString();
                try{
                    // attempt to parse the data as something other than a buffer.
                    let jsonData = JSON.parse(bufferData);
                    this._log.log({path:path, data:jsonData});
                    node.send([{topic:path, payload:jsonData}]);
                }
                catch(error){
                    this._log.log({path:path, data:bufferData});
                    node.send([{topic:path, payload:bufferData}]);
                }
            }
        }
        
        this._client.subscribe(this._subscriber)

        this.node().on("close", () => {
            this._client.unsubscribe(this._subscriber);
        });
    }
}
