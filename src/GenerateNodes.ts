import { NodeGenerator, NodeTypeService } from "@theotherwillembotha/node-red-plugincore";

import { ZookeeperServerConfigNode } from "./zookeeper/node/ZookeeperServerConfigNode";
import { ZookeeperEventNode } from "./zookeeper/node/ZookeeperEventNode";
import { ZookeeperWriteNode } from "./zookeeper/node/ZookeeperWriteNode";
import { ZookeeperReadNode } from "./zookeeper/node/ZookeeperReadNode";

new NodeGenerator("./src/zookeeper/")
    .registerService(NodeTypeService)
    .registerNode(ZookeeperServerConfigNode)
    .registerNode(ZookeeperEventNode)
    .registerNode(ZookeeperWriteNode)
    .registerNode(ZookeeperReadNode)
    .generate("./build/Nodes", "./build/Plugins", "@theotherwillembotha/node-red-zookeeper");

process.exit(0);
