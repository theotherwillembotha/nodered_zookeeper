
import { Node } from "node-red";
import { ConfigNode, ConfigNodeConfig, NodeDescription, SourceUtility } from "@theotherwillembotha/node-red-plugincore";
import { ZookeeperService, ZookeeperClient } from "../service/ZookeeperService";
import { Client, createClient as createZookeeperClient } from "node-zookeeper-client";

interface ZookeeperServerConfigNodeConfig extends ConfigNodeConfig {
    servers: string;
}

@NodeDescription({
    id:"ZookeeperServerConfigNode",
    name:"Zookeeper Config Node",
    group:"config",
    sourceFile:SourceUtility.getSourcePath("/build/", "/src/") + "ZookeeperServerConfigNode.html",
    package: "@theotherwillembotha/node-red-zookeeper",
    dependencies:[ ZookeeperService ],
    tags: [ "Zookeeper" ]
})
export class ZookeeperServerConfigNode extends ConfigNode<ZookeeperServerConfigNodeConfig> {
    private _client: ZookeeperClient;
    private _zk: Client;

    constructor(node: Node, config: ZookeeperServerConfigNodeConfig){
        super(node, config);
        let _this = this;
        this._zk = createZookeeperClient(config.servers);
        this._client = new ZookeeperClient(this._zk);
        this._zk.connect();

        this.node().on("close", () => {
            _this._zk.close();
        });
    }

    public client():ZookeeperClient {
        return this._client;
    }
}
