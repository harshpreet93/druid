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
import {
  H1,
  InputGroup,
  Button,
  Intent, Checkbox
} from "@blueprintjs/core";
import { AsyncActionDialog } from '../dialogs/async-action-dialog';
import { addFilter, formatNumber, formatBytes, countBy, lookupBy, QueryManager } from "../utils";
import { RetentionDialog } from '../dialogs/retention-dialog';

import "./data-source-view.scss";

export interface DataSourcesViewProps extends React.Props<any> {
  goToSql: (initSql: string) => void;
  goToSegments: (dataSource: string, onlyUnavailable?: boolean) => void;
}

export interface DataSourcesViewState {
  loadingDataSources: boolean;
  dataSources: any[] | null;
  dataSourceFilter: Filter[];

  showDisabled: boolean;
  retentionDialogOpenOn: string | null;
  dropDataDatasource: string | null;
  enableDatasource: string | null;
  killDatasource: string | null;
}

export class DataSourcesView extends React.Component<DataSourcesViewProps, DataSourcesViewState> {
  private dataSourceQueryManager: QueryManager<string, any[]>;

  constructor(props: DataSourcesViewProps, context: any) {
    super(props, context);
    this.state = {
      loadingDataSources: true,
      dataSources: null,
      dataSourceFilter: [],

      showDisabled: false,
      retentionDialogOpenOn: null,
      dropDataDatasource: null,
      enableDatasource: null,
      killDatasource: null
    };
  }

  componentDidMount(): void {
    this.dataSourceQueryManager = new QueryManager({
      processQuery: async (query: string) => {
        const dataSourcesResp = await axios.post("/druid/v2/sql", { query });
        const dataSources: any = dataSourcesResp.data;
        const seen = countBy(dataSources, (x: any) => x.datasource);

        const disabledResp = await axios.get('/druid/coordinator/v1/metadata/datasources?includeDisabled');
        const disabled: string[] = disabledResp.data.filter((d: string) => !seen[d]);

        const rulesResp = await axios.get('/druid/coordinator/v1/rules');
        const rules = rulesResp.data;
        const defaultRules = rules['_default'];

        const compactionResp = await axios.get('/druid/coordinator/v1/config/compaction');
        const compaction = lookupBy(compactionResp.data.compactionConfigs, (c: any) => c.dataSource);

        const allDatasources = dataSources.concat(disabled.map(d => ({ datasource: d, disabled: true })));
        allDatasources.forEach((ds: any) => {
          ds.rules = rules[ds.datasource] || [];
          ds.defaultRules = defaultRules;
          ds.compaction = compaction[ds.datasource];
        });

        return allDatasources;
      },
      onStateChange: ({ result, loading, error }) => {
        this.setState({
          dataSources: result,
          loadingDataSources: loading
        });
      }
    });

    this.dataSourceQueryManager.runQuery(`SELECT
  datasource,
  COUNT(*) AS num_segments,
  COUNT(*) FILTER(WHERE is_available = 1) AS num_available_segments,
  SUM("size") AS size,
  SUM("num_rows") AS num_rows
FROM sys.segments
GROUP BY 1`);
  }

  componentWillUnmount(): void {
    this.dataSourceQueryManager.terminate();
  }

  renderDropDataAction() {
    const { dropDataDatasource } = this.state;

    return <AsyncActionDialog
      action={
        dropDataDatasource ? async () => {
          const resp = await axios.delete(`/druid/coordinator/v1/datasources/${dropDataDatasource}`, {})
          return resp.data;
        } : null
      }
      confirmButtonText="Drop data"
      successText="Data has been dropped"
      failText="Could not drop data"
      intent={Intent.DANGER}
      onClose={(success) => {
        this.setState({ dropDataDatasource: null });
        if (success) this.dataSourceQueryManager.rerunLastQuery();
      }}
    >
      <p>
        {`Are you sure you want to drop all the data for datasource '${dropDataDatasource}'?`}
      </p>
    </AsyncActionDialog>;
  }

  renderEnableAction() {
    const { enableDatasource } = this.state;

    return <AsyncActionDialog
      action={
        enableDatasource ? async () => {
          const resp = await axios.post(`/druid/coordinator/v1/datasources/${enableDatasource}`, {})
          return resp.data;
        } : null
      }
      confirmButtonText="Enable datasource"
      successText="Datasource has been enabled"
      failText="Could not enable datasource"
      intent={Intent.PRIMARY}
      onClose={(success) => {
        this.setState({ enableDatasource: null });
        if (success) this.dataSourceQueryManager.rerunLastQuery();
      }}
    >
      <p>
        {`Are you sure you want to enable datasource '${enableDatasource}'?`}
      </p>
    </AsyncActionDialog>;
  }

  renderKillAction() {
    const { killDatasource } = this.state;

    return <AsyncActionDialog
      action={
        killDatasource ? async () => {
          const resp = await axios.delete(`/druid/coordinator/v1/datasources/${killDatasource}?kill=true&interval=1000/3000`, {});
          return resp.data;
        } : null
      }
      confirmButtonText="Permanently delete data"
      successText="Kill task was issued. Datasource will be deleted"
      failText="Could not submit kill task"
      intent={Intent.DANGER}
      onClose={(success) => {
        this.setState({ killDatasource: null });
        if (success) this.dataSourceQueryManager.rerunLastQuery();
      }}
    >
      <p>
        {`Are you sure you want to permanently delete the data in datasource '${killDatasource}'?`}
      </p>
      <p>
        This action can not be undone.
      </p>
    </AsyncActionDialog>;
  }

  renderRetentionDialog() {
    const { retentionDialogOpenOn } = this.state;

    return <RetentionDialog
      dataSource={retentionDialogOpenOn}
      isOpen={retentionDialogOpenOn != null}
      onClose={() => this.setState({retentionDialogOpenOn: null})}
    />;
  }

  renderDataSourceTable() {
    const { goToSegments } = this.props;
    const { dataSources, loadingDataSources, dataSourceFilter, showDisabled } = this.state;

    let data = dataSources || [];
    if (!showDisabled) {
      data = data.filter(d => !d.disabled)
    }

    return <>
      <ReactTable
        data={data}
        loading={loadingDataSources}
        filterable={true}
        filtered={dataSourceFilter}
        onFilteredChange={(filtered, column) => {
          this.setState({ dataSourceFilter: filtered });
        }}
        columns={[
          {
            Header: "Data source",
            accessor: "datasource",
            Cell: row => {
              const value = row.value;
              return <a onClick={() => { this.setState({ dataSourceFilter: addFilter(dataSourceFilter, 'datasource', value) }) }}>{value}</a>
            }
          },
          {
            Header: "Availability",
            id: "availability",
            filterable: false,
            accessor: (row) => row.num_available_segments / row.num_segments,
            Cell: (row) => {
              const { datasource, num_available_segments, num_segments, disabled } = row.original;
              if (disabled) return "Disabled";
              const segmentsEl = <a onClick={() => goToSegments(datasource)}>{`${formatNumber(num_segments)} segments`}</a>;
              if (num_available_segments === num_segments) {
                return <span>Fully available ({segmentsEl})</span>;
              } else {
                const percentAvailable = (Math.floor((num_available_segments / num_segments) * 1000) / 10).toFixed(1);
                const missing = num_segments - num_available_segments;
                const segmentsMissingEl = <a onClick={() => goToSegments(datasource, true)}>{`${formatNumber(missing)} segments unavailable`}</a>;
                return <span>{percentAvailable}% available ({segmentsEl}, {segmentsMissingEl})</span>;
              }
            }
          },
          {
            Header: 'Retention',
            id: 'retention',
            accessor: (row) => row.rules.length,
            filterable: false,
            Cell: row => {
              const { rules } = row.original;
              let text: string;
              if (rules.length === 0) {
                text = 'Cluster default';
              } else if (rules.length === 1) {
                text = rules[0].type;
              } else {
                text = `${rules.length} rules`;
              }

              return <span>{text} <a onClick={() => this.setState({retentionDialogOpenOn: row.original.datasource})}>&#9998;</a></span>;
            }
          },
          {
            Header: 'Compaction',
            id: 'compaction',
            accessor: (row) => Boolean(row.compaction),
            filterable: false,
            Cell: row => {
              const { compaction } = row.original;
              let text: string;
              if (compaction) {
                text = `Target: ${formatBytes(compaction.targetCompactionSizeBytes)}`;
              } else {
                text = 'None';
              }
              return <span>{text} <a onClick={() => alert('ToDo')}>&#9998;</a></span>;
            }
          },
          {
            Header: 'Size',
            accessor: 'size',
            filterable: false,
            width: 100,
            Cell: (row) => formatBytes(row.value)
          },
          {
            Header: 'Num rows',
            accessor: 'num_rows',
            filterable: false,
            width: 100,
            Cell: (row) => formatNumber(row.value)
          },
          {
            Header: 'Actions',
            accessor: 'datasource',
            id: 'actions',
            width: 200,
            filterable: false,
            Cell: row => {
              const datasource = row.value;
              const { disabled } = row.original;
              if (disabled) {
                return <div>
                  <a onClick={() => this.setState({ enableDatasource: datasource })}>Enable</a>&nbsp;&nbsp;&nbsp;
                  <a onClick={() => this.setState({ killDatasource: datasource })}>Permanently delete</a>
                </div>
              } else {
                return <div>
                  <a onClick={() => this.setState({ dropDataDatasource: datasource })}>Drop data</a>
                </div>
              }
            }
          }
        ]}
        defaultPageSize={50}
        className="-striped -highlight"
      />
      {this.renderDropDataAction()}
      {this.renderEnableAction()}
      {this.renderKillAction()}
      {this.renderRetentionDialog()}
    </>;
  }

  render() {
    const { goToSql } = this.props;
    const { showDisabled } = this.state;

    return <div className="data-sources-view app-view">
      <div className="control-bar">
        <H1>Datasources</H1>
        <Button
          icon="refresh"
          text="Refresh"
          onClick={() => this.dataSourceQueryManager.rerunLastQuery()}
        />
        <Button
          icon="console"
          text="Go to SQL"
          onClick={() => goToSql(this.dataSourceQueryManager.getLastQuery())}
        />
        <Checkbox checked={showDisabled} onChange={() => this.setState({ showDisabled: !showDisabled })}>Show disabled</Checkbox>
      </div>
      {this.renderDataSourceTable()}
    </div>
  }
}
