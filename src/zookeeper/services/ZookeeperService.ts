import { BaseService, ServiceDescriptor } from "@theotherwillembotha/node-red-plugincore";
import { NodeAPI, NodeAPISettingsWithData } from "node-red";
import { Client, CreateMode, createClient as createZookeeperClient } from "node-zookeeper-client";


export class ZookeeperService extends BaseService {

    private red!: NodeAPI<NodeAPISettingsWithData>;

    constructor(){
        super("ZookeeperService");
    }

    init(red: NodeAPI<NodeAPISettingsWithData>): void {
        this.red = red;

        this.red.httpAdmin.post("/zookeeperservice/testconnection", this.red.auth.needsPermission("inject.write"), (req, response) => {
            const { servers } = req.body as { servers: string };

            if (!servers) {
                response.status(400).send({ error: "servers is required" });
                return;
            }

            let sent = false;
            const client = createZookeeperClient(servers);

            const finish = (status: number, body: object) => {
                if (sent) return;
                sent = true;
                clearTimeout(timeout);
                try { client.close(); } catch(e) {}
                response.status(status).send(body);
            };

            const timeout = setTimeout(() => {
                finish(504, { error: "Connection timed out" });
            }, 5000);

            (client as any).addListener("error", (err: Error) => {
                finish(400, { error: err.message || "Connection error" });
            });

            client.addListener("state", (state) => {
                if (["SYNC_CONNECTED", "CONNECTED_READ_ONLY"].includes(state.name)) {
                    finish(200, { message: "Connected successfully" });
                } else if (state.name === "AUTH_FAILED") {
                    finish(401, { error: "Authentication failed" });
                }
            });

            client.connect();
        });
    }

    deinit(_red: NodeAPI<NodeAPISettingsWithData>): void {}

    static override getServiceDescriptor():ServiceDescriptor {
        return new ServiceDescriptor(
            "@theotherwillembotha/zookeeperservice",
            "ZookeeperService", 
            "integration-plugin",
            "./zookeeper/services/ZookeeperService",
            ZookeeperService);
    }
}

export enum ZookeeperClientState {
    Disconnected,
    Connected   
}

export type ZookeeperDataCallback = (path: string, data:Buffer<ArrayBufferLike>) => void

export  type ZookeeperSubscriber = { 
    subscriptions: string[];
    getvalueonsubscribe: boolean;
    callback: ZookeeperDataCallback; 
}

export class ZookeeperClient {
    private _client: Client;
    private _statusListeners:((status:ZookeeperClientState)=>void)[] = [];

    public constructor(client:Client){
        this._client = client;
        
        this._client.addListener("state", (state) => {
            if(["DISCONNECTED"].includes(state.name)){
                this._statusListeners.forEach(listener => listener(ZookeeperClientState.Disconnected))
            }

            if(["SYNC_CONNECTED", "CONNECTED_READ_ONLY"].includes(state.name)){
                this._statusListeners.forEach(listener => listener(ZookeeperClientState.Connected))
            }
            //if(state.name === "AUTH_FAILED"){ _this.node().status({fill:"red",shape:"dot",text:"Authentication Failed"}); }
            //if(state.name === "SASL_AUTHENTICATED"){ _this.node().status({fill:"green",shape:"dot",text:"Authenticated"}); }
            //if(state.name === "EXPIRED"){ _this.node().status({fill:"green",shape:"dot",text:"Expired"}); }
        })
    }

    public addStatusListener(listener:(status:ZookeeperClientState)=>void){
        this._statusListeners.push(listener);
    }

    public removeStatusListener(listener:(status:ZookeeperClientState)=>void){
        this._statusListeners.splice(this._statusListeners.indexOf(listener), 1);
    }

    public subscribe(subscriber:ZookeeperSubscriber) {
        for(let path of subscriber.subscriptions){
            // check if the path exists.
            this._client.exists(path,
                (error, stat) => {
                    // if the node exists, watch it. otherwise, wait for it to exist.
                    if(stat){
                        if(subscriber.getvalueonsubscribe){
                            this._client.getData(path, (error, data, stat) => {
                                subscriber.callback(path, data);
                            });
                        }
                        this.watch(path, subscriber.callback);
                        return;
                    }
                     this.waitForExists(path, subscriber.callback);
                }
            )
        };
    }

    private waitForExists(path:string, callback:ZookeeperDataCallback){
        this._client.exists(path, 
            (event) => {
                // if the node now eixsts, watch it.
                if(event.name === "NODE_CREATED"){
                    this.watch(path, callback);
                    return;
                }

                console.error("Unhandled ZooKeeper exists event:", event);
            } ,
            (error, stat) => {}
        )
    }

    private watch(path:string, callback:ZookeeperDataCallback){
        this._client.getData(path,
            (event) => {
                // if the node data changed, just watch it again.
                if(event.name === "NODE_DATA_CHANGED"){
                    this.watch(path, callback);
                    return;
                }
                // if the node data changed, regiser a new create observer
                if(event.name === "NODE_DELETED"){
                   this.waitForExists(path, callback);
                   return;
                }
            },
            (error, data, stat) => {
                // if there is an error, it probably means that the node was deleted.
                if(error){ return; }
                callback(path, data);
            }
        )
    }

    public unsubscribe(_subscriber: ZookeeperSubscriber) {
        // ZooKeeper watchers are one-shot and re-register themselves internally.
        // Active watchers will naturally stop re-registering once the underlying
        // ZK connection closes (when the config node is torn down on redeploy).
    }


    protected getOrCreate(path: string):Promise<void> {
        // break the path up into smaller bits.
        let parts = path.split("/");
        
        let promise = Promise.resolve();
        for(let i = 1; i < parts.length; i++){
            let currentPath =  parts.slice(0, i+1).join("/");

            promise = promise.then(() => new Promise((resolve, reject) => {
                this._client.exists(currentPath, (error, stat) => {
                    if(stat){
                        resolve(undefined);
                    }
                    else{
                        this._client.create(currentPath, CreateMode.PERSISTENT, (error, stat) => {
                            if(stat){
                                resolve(undefined);
                            }
                            else{
                                reject(error);
                            }
                        });
                    }
                });
            }));
        }


        return promise;
    }

    public writeNode(path: string, data:any):Promise<void> {
        return this.getOrCreate(path).then(() => {
            this._client.setData(path, Buffer.from(data), (error, stat) => {});
        })
    }

    public async readNode(path:string):Promise<Buffer<ArrayBufferLike>> {
        return new Promise((resolve, reject) => {

            this._client.exists(path,
                (error, stat) => {
                    if(error){
                        reject();
                    }
                    else{
                        this._client.getData(path, (error, data, stat) => { resolve(data) });
                    }
                }
            )
        });
    }
}