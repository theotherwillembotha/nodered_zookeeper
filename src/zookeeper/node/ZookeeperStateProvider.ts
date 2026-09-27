import { NodeManager } from "@theotherwillembotha/node-red-plugincore";
import { StateHandle, StateService } from "@theotherwillembotha/node-red-plugincore";
import { ConfigFragmentService } from "@theotherwillembotha/node-red-plugincore";
import { ZookeeperClient } from "../service/ZookeeperService";

// ******************************************************* //
//                   ZookeeperStateHandle                  //
// ******************************************************* //

class ZookeeperStateHandle implements StateHandle {
    private _zkClient: ZookeeperClient;
    private _path: string;
    private _forwardMap: Record<string, string>;
    private _reverseMap: Record<string, string>;
    private _cancelled = false;
    private _subscriber: import("../service/ZookeeperService").ZookeeperSubscriber | null = null;

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
        }).catch(err => {
            console.error(`ZookeeperStateHandle.get(${this._path}) error:`, String(err));
            return null;
        });
    }

    public set(stateName: string): Promise<void> {
        const mapped = this._forwardMap[stateName] ?? stateName;
        return this._zkClient.writeNode(this._path, mapped).catch(err => {
            console.error(`ZookeeperStateHandle.set(${this._path}) error:`, String(err));
        });
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

// ── Type-based factory (keyed by ZookeeperServerConfigNode, the tagged StateProvider) ──

StateService.registerTypeFactory("ZookeeperServerConfigNode", (ownerId: string, config: any, providerRef: string) => {
    const serverNode = (NodeManager.RED.nodes.getNode(providerRef) as any)?.node();
    if (!serverNode) {
        console.error("ZookeeperStateFactory: server config node not found:", providerRef);
        return new (class implements StateHandle {
            get() { return Promise.resolve(null); }
            set() { return Promise.resolve(); }
            subscribe() {}
            unsubscribe() {}
        })();
    }
    const zkClient: ZookeeperClient = serverNode.client();

    let forwardMap: Record<string, string> = {};
    try { forwardMap = JSON.parse(config.stateMap || '{}'); } catch {}

    const reverseMap: Record<string, string> = {};
    for (const [k, v] of Object.entries(forwardMap)) {
        reverseMap[v as string] = k;
    }

    return new ZookeeperStateHandle(zkClient, config.znodePath || '/node-red/state', forwardMap, reverseMap);
});

// ── ConfigFragment registration ──

try {
    const zookeeperStateHtml: string = require('../fragments/ZookeeperStateFragment.html');
    ConfigFragmentService.registerFragment({
        section: 'StateConfig',
        providerType: 'ZookeeperServerConfigNode',
        html: zookeeperStateHtml,
    });
} catch(_e) {
    // Expected during generate-nodes (pre-esbuild)
}
