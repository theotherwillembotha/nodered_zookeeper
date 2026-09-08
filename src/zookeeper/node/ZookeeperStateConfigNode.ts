import { Node } from "node-red";
import { ConfigNodeConfig, SourceUtility, NodeManager } from "@theotherwillembotha/node-red-plugincore";
import { NodeDescription } from "@theotherwillembotha/node-red-plugincore";
import { StateConfigNode, StateHandle } from "@theotherwillembotha/node-red-plugincore";
import { ZookeeperClient, ZookeeperSubscriber } from "../service/ZookeeperService";

interface ZookeeperStateConfigNodeConfig extends ConfigNodeConfig {
    serverconfig: string;
    znodePath: string;
    stateMap: string;  // JSON: Record<string, string> — maps internal state names to external ZK values
}

// ******************************************************* //
//                   ZookeeperStateHandle                  //
// ******************************************************* //

class ZookeeperStateHandle implements StateHandle {
    private _zkClient: ZookeeperClient;
    private _path: string;
    private _forwardMap: Record<string, string>;  // internal name → external ZK value
    private _reverseMap: Record<string, string>;  // external ZK value → internal name
    private _cancelled = false;
    private _subscriber: ZookeeperSubscriber | null = null;

    constructor(
        zkClient: ZookeeperClient,
        path: string,
        forwardMap: Record<string, string>,
        reverseMap: Record<string, string>
    ) {
        this._zkClient = zkClient;
        this._path = path;
        this._forwardMap = forwardMap;
        this._reverseMap = reverseMap;
    }

    public get(): Promise<string | null> {
        return this._zkClient.readNode(this._path).then(data => {
            if (data === null) return null;
            const raw = data.toString('utf8');
            return this._reverseMap[raw] ?? raw;
        });
    }

    public set(stateName: string): Promise<void> {
        const mapped = this._forwardMap[stateName] ?? stateName;
        return this._zkClient.writeNode(this._path, mapped);
    }

    public subscribe(callback: (stateName: string) => void): void {
        this._cancelled = false;
        this._subscriber = {
            subscriptions: [this._path],
            getvalueonsubscribe: false,
            callback: (_path, data) => {
                if (this._cancelled) return;
                const raw = data ? data.toString('utf8') : null;
                if (raw === null) return;
                const mapped = this._reverseMap[raw] ?? raw;
                callback(mapped);
            }
        };
        this._zkClient.subscribe(this._subscriber);
    }

    public unsubscribe(): void {
        this._cancelled = true;
        if (this._subscriber) {
            this._zkClient.unsubscribe(this._subscriber);
            this._subscriber = null;
        }
    }
}

// ******************************************************* //
//                ZookeeperStateConfigNode                 //
// ******************************************************* //

@NodeDescription({
    id: "ZookeeperStateConfigNode",
    name: "ZooKeeper State Config",
    group: "config",
    sourceFile: SourceUtility.getSourcePath("/build/", "/src/") + "ZookeeperStateConfigNode.html",
    package: "@theotherwillembotha/node-red-zookeeper",
    tags: ["StateProvider"]
})
export class ZookeeperStateConfigNode extends StateConfigNode {

    constructor(node: Node, config: ZookeeperStateConfigNodeConfig) {
        super(node, config);
    }

    public createHandle(): StateHandle {
        const cfg = this.config() as ZookeeperStateConfigNodeConfig;

        const serverNode = (NodeManager.RED.nodes.getNode(cfg.serverconfig) as any).node();
        const zkClient: ZookeeperClient = serverNode.client();

        let forwardMap: Record<string, string> = {};
        try { forwardMap = JSON.parse(cfg.stateMap || '{}'); } catch {}

        const reverseMap: Record<string, string> = {};
        for (const [k, v] of Object.entries(forwardMap)) {
            reverseMap[v] = k;
        }

        return new ZookeeperStateHandle(zkClient, cfg.znodePath, forwardMap, reverseMap);
    }
}
