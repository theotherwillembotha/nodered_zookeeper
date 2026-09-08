import { NodeGenerator } from "@theotherwillembotha/node-red-plugincore";
import {
    LoggerService, MetricsService, NodeTypeService, SettingsService, StateService,
    DelegatedConfigReferenceNode,
    ConsoleLoggerConfigNode, RestLoggerConfigNode,
    CounterMetricConfigNode, GaugeMetricConfigNode, TimerMetricConfigNode,
} from "@theotherwillembotha/node-red-plugincore";

import { ZookeeperService } from "./zookeeper/service/ZookeeperService";
import { ZookeeperStateConfigNode } from "./zookeeper/node/ZookeeperStateConfigNode";
import { ZookeeperServerConfigNode } from "./zookeeper/node/ZookeeperServerConfigNode";
import { ZookeeperEventNode } from "./zookeeper/node/ZookeeperEventNode";
import { ZookeeperWriteNode } from "./zookeeper/node/ZookeeperWriteNode";
import { ZookeeperReadNode } from "./zookeeper/node/ZookeeperReadNode";

new NodeGenerator("./src/zookeeper/")
    // infrastructure (required — deduplication guards make this safe)
    .registerService(LoggerService)
    .registerService(MetricsService)
    .registerService(NodeTypeService)
    .registerService(SettingsService)
    .registerService(StateService)
    .registerNode(DelegatedConfigReferenceNode)
    .registerNode(ConsoleLoggerConfigNode)
    .registerNode(RestLoggerConfigNode)
    .registerNode(CounterMetricConfigNode)
    .registerNode(GaugeMetricConfigNode)
    .registerNode(TimerMetricConfigNode)

    // zookeeper
    .registerService(ZookeeperService)
    .registerNode(ZookeeperStateConfigNode)
    .registerNode(ZookeeperServerConfigNode)
    .registerNode(ZookeeperEventNode)
    .registerNode(ZookeeperWriteNode)
    .registerNode(ZookeeperReadNode)

    .generate("./build/Nodes", "./build/Plugins");

process.exit(0);