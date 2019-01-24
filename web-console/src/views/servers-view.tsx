/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import axios from 'axios';
import * as React from 'react';
import * as classNames from 'classnames';
import ReactTable from "react-table";
import { Filter } from "react-table";
import { sum } from "d3-array";
import {
  Button,
  H1,
  Switch
} from "@blueprintjs/core";
import { addFilter, formatBytesCompact, QueryManager } from "../utils";
import "./servers-view.scss";

function formatQueues(segmentsToLoad: number, segmentsToLoadSize: number, segmentsToDrop: number, segmentsToDropSize: number): string {
  let queueParts: string[] = [];
  if (segmentsToLoad) {
    queueParts.push(`${segmentsToLoad} segments to load (${formatBytesCompact(segmentsToLoadSize)})`);
  }
  if (segmentsToDrop) {
    queueParts.push(`${segmentsToDrop} segments to drop (${formatBytesCompact(segmentsToDropSize)})`);
  }
  return queueParts.join(', ') || 'Empty queues';
}

export interface ServersViewProps extends React.Props<any> {
  goToSql: (initSql: string) => void;
  goToTask: (taskId: string) => void;
}

export interface ServersViewState {
  serversLoading: boolean;
  servers: any[] | null;
  serverFilter: Filter[];
  groupByTier: boolean;

  middleManagersLoading: boolean;
  middleManagers: any[] | null;
  middleManagerFilter: Filter[];
}

export class ServersView extends React.Component<ServersViewProps, ServersViewState> {
  private serverQueryManager: QueryManager<string, any[]>;
  private middleManagerQueryManager: QueryManager<string, any[]>;

  constructor(props: ServersViewProps, context: any) {
    super(props, context);
    this.state = {
      serversLoading: true,
      servers: null,
      serverFilter: [],
      groupByTier: false,

      middleManagersLoading: true,
      middleManagers: null,
      middleManagerFilter: []
    };
  }

  componentDidMount(): void {
    this.serverQueryManager = new QueryManager({
      processQuery: async (query: string) => {
        let serversResponse = await axios.post("/druid/v2/sql", { query });
        let loadQueueResponse = await axios.get("/druid/coordinator/v1/loadqueue?simple");

        const servers = serversResponse.data;
        const loadQueues = loadQueueResponse.data;

        return servers.map((s: any) => {
          const loadQueueInfo = loadQueues[s.server];
          if (loadQueueInfo) {
            s = Object.assign(s, loadQueueInfo);
          }
          return s;
        });
      },
      onStateChange: ({ result, loading, error }) => {
        this.setState({
          servers: result,
          serversLoading: loading
        });
      }
    });

    this.serverQueryManager.runQuery(`SELECT
  "tier", "server", "host", "plaintext_port", "tls_port", "curr_size", "max_size"
FROM sys.servers
WHERE "server_type" = 'historical'`);

    this.middleManagerQueryManager = new QueryManager({
      processQuery: async (query: string) => {
        const resp = await axios.get("/druid/indexer/v1/workers");
        return resp.data;
      },
      onStateChange: ({ result, loading, error }) => {
        this.setState({
          middleManagers: result,
          middleManagersLoading: loading
        });
      }
    });

    this.middleManagerQueryManager.runQuery('dummy');
  }

  componentWillUnmount(): void {
    this.serverQueryManager.terminate();
    this.middleManagerQueryManager.terminate();
  }

  renderServersTable() {
    const { servers, serversLoading, serverFilter, groupByTier } = this.state;

    const fillIndicator = (value: number) => {
      return <div className="fill-indicator"
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#dadada',
          borderRadius: '2px'
        }}
      >
        <div
          style={{
            width: `${value * 100}%`,
            height: '100%',
            backgroundColor: '#85cc00',
            borderRadius: '2px',
            transition: 'all .2s ease-out'
          }}
        />
      </div>;
    }

    return <ReactTable
      data={servers || []}
      loading={serversLoading}
      filterable={true}
      filtered={serverFilter}
      onFilteredChange={(filtered, column) => {
        this.setState({ serverFilter: filtered });
      }}
      pivotBy={groupByTier ? ["tier"] : []}
      columns={[
        {
          Header: "Tier",
          accessor: "tier",
          Cell: row => {
            const value = row.value;
            return <a onClick={() => { this.setState({ serverFilter: addFilter(serverFilter, 'tier', value) }) }}>{value}</a>
          }
        },
        {
          Header: "Server",
          accessor: "server",
          width: 300
        },
        {
          Header: "Size",
          id: 'size',
          width: 100,
          filterable: false,
          accessor: (row) => row.max_size ? (row.curr_size / row.max_size) : null,
          Aggregated: row => {
            const originals = row.subRows.map(r => r._original);
            const totalCurr = sum(originals, s => s.currSize);
            const totalMax = sum(originals, s => s.currMax);
            return fillIndicator(totalCurr / totalMax);
          },
          Cell: row => {
            if (row.aggregated) return '';
            if (row.value === null) return '';
            return fillIndicator(row.value);
          }
        },
        {
          Header: "Load/drop queues",
          id: 'queue',
          width: 400,
          filterable: false,
          accessor: (row) => (row.segmentsToLoad || 0) + (row.segmentsToDrop || 0),
          Cell: (row => {
            if (row.aggregated) return '';
            const { segmentsToLoad, segmentsToLoadSize, segmentsToDrop, segmentsToDropSize } = row.original;
            return formatQueues(segmentsToLoad, segmentsToLoadSize, segmentsToDrop, segmentsToDropSize);
          }),
          Aggregated: row => {
            const originals = row.subRows.map(r => r._original);
            const segmentsToLoad = sum(originals, s => s.segmentsToLoad);
            const segmentsToLoadSize = sum(originals, s => s.segmentsToLoadSize);
            const segmentsToDrop = sum(originals, s => s.segmentsToDrop);
            const segmentsToDropSize = sum(originals, s => s.segmentsToDropSize);
            return formatQueues(segmentsToLoad, segmentsToLoadSize, segmentsToDrop, segmentsToDropSize);
          },
        },
        {
          Header: "Host",
          accessor: "host",
          Aggregated: () => ''
        },
        {
          Header: "Port",
          id: 'port',
          accessor: (row) => {
            let ports: string[] = [];
            if (row.plaintext_port !== -1) {
              ports.push(`${row.plaintext_port} (plain)`);
            }
            if (row.tls_port !== -1) {
              ports.push(`${row.tls_port} (TLS)`);
            }
            return ports.join(', ') || 'No port';
          },
          Aggregated: () => ''
        },
      ]}
      defaultPageSize={10}
      className="-striped -highlight"
    />;
  }

  renderMiddleManagerTable() {
    const { goToTask } = this.props;
    const { middleManagers, middleManagersLoading, middleManagerFilter } = this.state;

    return <ReactTable
      data={middleManagers || []}
      loading={middleManagersLoading}
      filterable={true}
      filtered={middleManagerFilter}
      onFilteredChange={(filtered, column) => {
        this.setState({ middleManagerFilter: filtered });
      }}
      columns={[
        {
          Header: "Host",
          id: "host",
          accessor: (row) => row.worker.host,
          Cell: row => {
            const value = row.value;
            return <a onClick={() => { this.setState({ middleManagerFilter: addFilter(middleManagerFilter, 'host', value) }) }}>{value}</a>
          }
        },
        {
          Header: "Usage",
          id: "usage",
          accessor: (row) => `${row.currCapacityUsed} / ${row.worker.capacity}`,
          filterable: false
        },
        {
          Header: "Availability groups",
          id: "availabilityGroups",
          accessor: (row) => row.availabilityGroups.length,
          filterable: false,
        },
        {
          Header: "Last completed task time",
          accessor: "lastCompletedTaskTime"
        },
        {
          Header: "Blacklisted until",
          accessor: "blacklistedUntil"
        }
      ]}
      defaultPageSize={10}
      className="-striped -highlight"
      SubComponent={rowInfo => {
        const runningTasks = rowInfo.original.runningTasks;
        return <div style={{ padding: "20px" }}>
          <span>Running tasks:</span>
          <ul>
            { runningTasks.map((t: string) => <li key={t}><a onClick={() => goToTask(t)}>{t}</a></li>) }
          </ul>
        </div>;
      }}
    />;
  }

  render() {
    const { goToSql } = this.props;
    const { groupByTier } = this.state;

    return <div className="servers-view app-view">
      <div className="control-bar">
        <H1>Data servers</H1>
        <Button
          icon="refresh"
          text="Refresh"
          onClick={() => this.serverQueryManager.rerunLastQuery()}
        />
        <Button
          icon="console"
          text="Go to SQL"
          onClick={() => goToSql(this.serverQueryManager.getLastQuery())}
        />
        <Switch
          checked={groupByTier}
          label="Group by tier"
          onChange={() => this.setState({ groupByTier: !groupByTier })}
        />
      </div>
      {this.renderServersTable()}

      <div className="control-bar">
        <H1>MiddleManagers</H1>
        <Button
          icon="refresh"
          text="Refresh"
          onClick={() => this.middleManagerQueryManager.rerunLastQuery()}
        />
      </div>
      {this.renderMiddleManagerTable()}
    </div>
  }
}
