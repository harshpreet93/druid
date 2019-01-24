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
import { Button, H1, ButtonGroup, Intent, Label } from "@blueprintjs/core";
import { addFilter, QueryManager } from "../utils";
import { AsyncActionDialog } from "../dialogs/async-action-dialog";
import "./tasks-view.scss";

export interface TasksViewProps extends React.Props<any> {
  taskId: string | null;
  goToSql: (initSql: string) => void;
}

export interface TasksViewState {
  loadingSupervisors: boolean;
  supervisors: any[];

  resumeSupervisorId: string | null;
  suspendSupervisorId: string | null;
  resetSupervisorId: string | null;
  terminateSupervisorId: string | null;

  loadingTasks: boolean;
  tasks: any[] | null;
  taskFilter: Filter[];
  groupTasksBy: null | 'type' | 'datasource' | 'status';

  killTaskId: string | null;
}

function statusToColor(status: string): string {
  switch (status) {
    case 'RUNNING': return '#2167d5';
    case 'WAITING': return '#d5631a';
    case 'PENDING': return '#ffbf00';
    case 'SUCCESS': return '#57d500';
    case 'FAILED': return '#d5100a';
    default: return '#0a1500';
  }
}

export class TasksView extends React.Component<TasksViewProps, TasksViewState> {
  private supervisorQueryManager: QueryManager<string, any[]>;
  private taskQueryManager: QueryManager<string, any[]>;

  constructor(props: TasksViewProps, context: any) {
    super(props, context);
    this.state = {
      loadingSupervisors: true,
      supervisors: [],

      resumeSupervisorId: null,
      suspendSupervisorId: null,
      resetSupervisorId: null,
      terminateSupervisorId: null,

      loadingTasks: true,
      tasks: null,
      taskFilter: props.taskId ? [{ id: 'task_id', value: props.taskId }] : [],
      groupTasksBy: null,

      killTaskId: null
    };
  }

  componentDidMount(): void {
    this.supervisorQueryManager = new QueryManager({
      processQuery: async (query: string) => {
        const resp = await axios.get("/druid/indexer/v1/supervisor?full")
        return resp.data;
      },
      onStateChange: ({ result, loading, error }) => {
        this.setState({
          supervisors: result,
          loadingSupervisors: loading
        });
      }
    });

    this.supervisorQueryManager.runQuery('dummy');

    this.taskQueryManager = new QueryManager({
      processQuery: async (query: string) => {
        const resp = await axios.post("/druid/v2/sql", { query });
        return resp.data;
      },
      onStateChange: ({ result, loading, error }) => {
        this.setState({
          tasks: result,
          loadingTasks: loading
        });
      }
    });

    this.taskQueryManager.runQuery(`SELECT
  "task_id", "type", "datasource", "created_time",
  CASE WHEN "status" = 'RUNNING' THEN "runner_status" ELSE "status" END AS "status"
FROM sys.tasks`);
  }

  componentWillUnmount(): void {
    this.supervisorQueryManager.terminate();
    this.taskQueryManager.terminate();
  }

  renderResumeSupervisorAction() {
    const { resumeSupervisorId } = this.state;

    return <AsyncActionDialog
      action={
        resumeSupervisorId ? async () => {
          const resp = await axios.post(`/druid/indexer/v1/supervisor/${resumeSupervisorId}/suspend`, {})
          return resp.data;
        } : null
      }
      confirmButtonText="Resume supervisor"
      successText="Supervisor has been resumed"
      failText="Could not resume supervisor"
      intent={Intent.PRIMARY}
      onClose={(success) => {
        this.setState({ resumeSupervisorId: null });
        if (success) this.supervisorQueryManager.rerunLastQuery();
      }}
    >
      <p>
        {`Are you sure you want to resume supervisor '${resumeSupervisorId}'?`}
      </p>
    </AsyncActionDialog>;
  }

  renderSuspendSupervisorAction() {
    const { suspendSupervisorId } = this.state;

    return <AsyncActionDialog
      action={
        suspendSupervisorId ? async () => {
          const resp = await axios.post(`/druid/indexer/v1/supervisor/${suspendSupervisorId}/suspend`, {});
          return resp.data;
        } : null
      }
      confirmButtonText="Suspend supervisor"
      successText="Supervisor has been suspended"
      failText="Could not suspend supervisor"
      intent={Intent.DANGER}
      onClose={(success) => {
        this.setState({ suspendSupervisorId: null });
        if (success) this.supervisorQueryManager.rerunLastQuery();
      }}
    >
      <p>
        {`Are you sure you want to suspend supervisor '${suspendSupervisorId}'?`}
      </p>
    </AsyncActionDialog>;
  }

  renderResetSupervisorAction() {
    const { resetSupervisorId } = this.state;

    return <AsyncActionDialog
      action={
        resetSupervisorId ? async () => {
          const resp = await axios.post(`/druid/indexer/v1/supervisor/${resetSupervisorId}/reset`, {});
          return resp.data;
        } : null
      }
      confirmButtonText="Reset supervisor"
      successText="Supervisor has been reset"
      failText="Could not reset supervisor"
      intent={Intent.DANGER}
      onClose={(success) => {
        this.setState({ resetSupervisorId: null });
        if (success) this.supervisorQueryManager.rerunLastQuery();
      }}
    >
      <p>
        {`Are you sure you want to reset supervisor '${resetSupervisorId}'?`}
      </p>
    </AsyncActionDialog>;
  }

  renderTerminateSupervisorAction() {
    const { terminateSupervisorId } = this.state;

    return <AsyncActionDialog
      action={
        terminateSupervisorId ? async () => {
          const resp = await axios.post(`/druid/indexer/v1/supervisor/${terminateSupervisorId}/reset`, {});
          return resp.data;
        } : null
      }
      confirmButtonText="Terminate supervisor"
      successText="Supervisor has been terminated"
      failText="Could not terminate supervisor"
      intent={Intent.DANGER}
      onClose={(success) => {
        this.setState({ terminateSupervisorId: null });
        if (success) this.supervisorQueryManager.rerunLastQuery();
      }}
    >
      <p>
        {`Are you sure you want to terminate supervisor '${terminateSupervisorId}'?`}
      </p>
      <p>
        This action is not reversible.
      </p>
    </AsyncActionDialog>;
  }

  renderSupervisorTable() {
    const { supervisors, loadingSupervisors } = this.state;

    return <>
      <ReactTable
        data={supervisors || []}
        loading={loadingSupervisors}
        filterable={true}
        columns={[
          {
            Header: "Data source",
            accessor: "id",
            id: 'datasource',
            width: 300
          },
          {
            Header: "Status",
            id: 'status',
            accessor: (row) => row.spec.suspended ? 'Suspended' : 'Running',
            Cell: row => {
              const value = row.value;
              return <span>
                <span
                  style={{ color: value === 'Suspended' ? '#d58512' : '#2167d5' }}
                >&#x25cf;&nbsp;</span>
                {value}
              </span>;
            }
          },
          {
            Header: 'Actions',
            id: 'actions',
            accessor: 'id',
            width: 400,
            filterable: false,
            Cell: row => {
              const id = row.value;
              const suspendResume = row.original.spec.suspended ?
                <a onClick={() => this.setState({ resumeSupervisorId: id })}>Resume</a> :
                <a onClick={() => this.setState({ suspendSupervisorId: id })}>Suspend</a>;

              return <div>
                <a href={`/druid/indexer/v1/supervisor/${id}`} target="_blank">Payload</a>&nbsp;&nbsp;&nbsp;
                <a href={`/druid/indexer/v1/supervisor/${id}/status`} target="_blank">Status</a>&nbsp;&nbsp;&nbsp;
                <a href={`/druid/indexer/v1/supervisor/${id}/history`} target="_blank">History</a>&nbsp;&nbsp;&nbsp;
                {suspendResume}&nbsp;&nbsp;&nbsp;
                <a onClick={() => this.setState({ resetSupervisorId: id })}>Reset</a>&nbsp;&nbsp;&nbsp;
                <a onClick={() => this.setState({ terminateSupervisorId: id })}>Terminate</a>
              </div>
            }
          }
        ]}
        defaultPageSize={10}
        className="-striped -highlight"
      />
      {this.renderResumeSupervisorAction()}
      {this.renderSuspendSupervisorAction()}
      {this.renderResetSupervisorAction()}
      {this.renderTerminateSupervisorAction()}
    </>;
  }

  // --------------------------------------

  renderKillTaskAction() {
    const { killTaskId } = this.state;

    return <AsyncActionDialog
      action={
        killTaskId ? async () => {
          const resp = await axios.post(`/druid/indexer/v1/task/${killTaskId}/shutdown`, {});
          return resp.data;
        } : null
      }
      confirmButtonText="Kill task"
      successText="Task was killed"
      failText="Could not kill task"
      intent={Intent.DANGER}
      onClose={(success) => {
        this.setState({ killTaskId: null });
        if (success) this.taskQueryManager.rerunLastQuery();
      }}
    >
      <p>
        {`Are you sure you want to kill task '${killTaskId}'?`}
      </p>
    </AsyncActionDialog>;
  }

  renderTaskTable() {
    const { tasks, loadingTasks, taskFilter, groupTasksBy } = this.state;

    return <>
      <ReactTable
        data={tasks || []}
        loading={loadingTasks}
        filterable={true}
        filtered={taskFilter}
        onFilteredChange={(filtered, column) => {
          this.setState({ taskFilter: filtered });
        }}
        pivotBy={groupTasksBy ? [groupTasksBy] : []}
        columns={[
          {
            Header: "Task ID",
            accessor: "task_id",
            width: 300,
            Aggregated: row => ''
          },
          {
            Header: "Type",
            accessor: "type",
            Cell: row => {
              const value = row.value;
              return <a onClick={() => { this.setState({ taskFilter: addFilter(taskFilter, 'type', value) }) }}>{value}</a>
            }
          },
          {
            Header: "Data source",
            accessor: "datasource",
            Cell: row => {
              const value = row.value;
              return <a onClick={() => { this.setState({ taskFilter: addFilter(taskFilter, 'datasource', value) }) }}>{value}</a>
            }
          },
          {
            Header: "Created time",
            accessor: "created_time",
            Aggregated: row => ''
          },
          {
            Header: "Status",
            accessor: "status",
            Cell: row => {
              const value = row.value;
              return <a onClick={() => { this.setState({ taskFilter: addFilter(taskFilter, 'status', value) }) }}>
                <span
                  style={{ color: statusToColor(value) }}
                >&#x25cf;&nbsp;</span>
                {value}
              </a>;
            }
          },
          {
            Header: 'Actions',
            id: 'actions',
            accessor: 'task_id',
            width: 300,
            filterable: false,
            Cell: row => {
              if (row.aggregated) return '';
              const id = row.value;
              const { status } = row.original;
              return <div>
                <a href={`/druid/indexer/v1/task/${id}`} target="_blank">Payload</a>&nbsp;&nbsp;&nbsp;
                <a href={`/druid/indexer/v1/task/${id}/status`} target="_blank">Status</a>&nbsp;&nbsp;&nbsp;
                <a href={`/druid/indexer/v1/task/${id}/log`} target="_blank">Log (all)</a>&nbsp;&nbsp;&nbsp;
                <a href={`/druid/indexer/v1/task/${id}/log?offset=-8192`} target="_blank">Log (last 8kb)</a>&nbsp;&nbsp;&nbsp;
                { (status === 'RUNNING') && <a onClick={() => this.setState({ killTaskId: id })}>Kill</a> }
              </div>
            },
            Aggregated: row => ''
          }
        ]}
        defaultPageSize={20}
        className="-striped -highlight"
      />
      {this.renderKillTaskAction()}
    </>;
  }

  render() {
    const { goToSql } = this.props;
    const { groupTasksBy } = this.state;

    return <div className="tasks-view app-view">
      <div className="control-bar">
        <H1>Supervisors</H1>
        <Button
          icon="refresh"
          text="Refresh"
          onClick={() => this.supervisorQueryManager.rerunLastQuery()}
        />
      </div>
      {this.renderSupervisorTable()}

      <div className="control-bar">
        <H1>Tasks</H1>
        <Button
          icon="refresh"
          text="Refresh"
          onClick={() => this.taskQueryManager.rerunLastQuery()}
        />
        <Button
          icon="console"
          text="Go to SQL"
          onClick={() => goToSql(this.taskQueryManager.getLastQuery())}
        />
        <Label>Group by</Label>
        <ButtonGroup>
          <Button active={groupTasksBy === null} onClick={() => this.setState({ groupTasksBy: null })}>None</Button>
          <Button active={groupTasksBy === 'type'} onClick={() => this.setState({ groupTasksBy: 'type' })}>Type</Button>
          <Button active={groupTasksBy === 'datasource'} onClick={() => this.setState({ groupTasksBy: 'datasource' })}>Datasource</Button>
          <Button active={groupTasksBy === 'status'} onClick={() => this.setState({ groupTasksBy: 'status' })}>Status</Button>
        </ButtonGroup>
      </div>
      {this.renderTaskTable()}
    </div>
  }
}
