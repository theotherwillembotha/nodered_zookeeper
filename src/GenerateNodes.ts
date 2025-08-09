import { NodeGenerator } from "@theotherwillembotha/node-red-plugincore"

import { ZookeeperService } from "./zookeeper/services/ZookeeperService";
import { ZookeeperServerConfigNode } from "./zookeeper/nodes/ZookeeperServerConfigNode";
import { ZookeeperEventNode } from "./zookeeper/nodes/ZookeeperEventNode";
import { ZookeeperWriteNode } from "./zookeeper/nodes/ZookeeperWriteNode";
import { ZookeeperReadNode } from "./zookeeper/nodes/ZookeeperReadNode";

new NodeGenerator("./src/")
    // services.
    .registerService(ZookeeperService)

    // nodes
    .registerNode(ZookeeperServerConfigNode)
    .registerNode(ZookeeperEventNode)
    .registerNode(ZookeeperWriteNode)
    .registerNode(ZookeeperReadNode)

    // done.
    .generate("./build/Nodes", "./build/Plugins");

process.exit(0);