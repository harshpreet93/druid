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

import * as React from 'react';
import axios from 'axios';
import {
  FormGroup,
  Button,
  InputGroup,
  Dialog,
  NumericInput,
  Classes,
  Tooltip,
  AnchorButton,
  TagInput,
  Intent,
  ButtonGroup,
  HTMLSelect
} from "@blueprintjs/core";
import "./runtime-property-dialog.scss"
import { AutoForm } from '../components/auto-form';

interface ConfigSetting {
  balancerComputeThreads: number,
  emitBalancingStats: boolean,
  killAllDataSources: boolean,
  killDataSourceWhitelist : string[],
  killPendingSegmentsSkipList: string[],
  maxSegmentsInNodeLoadingQueue: number,
  maxSegmentsToMove: number,
  mergeBytesLimit: number,
  mergeSegmentsLimit: number,
  millisToWaitBeforeDeleting: number,
  replicantLifeTime: number,
  replicationThrottleLimit: number
}

export interface RuntimePropertyDialogProps extends React.Props<any> {
  isOpen: boolean,
  onClose: () => void
}

export interface RuntimePropertyDialogState {
  configSetting: Partial<ConfigSetting>;
  configAuthor: string;
  configComment: string;
}

export class RuntimePropertyDialog extends React.Component<RuntimePropertyDialogProps, RuntimePropertyDialogState> {
  constructor(props: RuntimePropertyDialogProps) {
    super(props);
    this.state = {
      configSetting: {},
      configComment: "",
      configAuthor: ""
    }
  }

  async getClusterConfig() {
    let resp: any;
    try {
      resp = await axios.get("/druid/coordinator/v1/config");
      resp = resp.data
    } catch (error) {
      console.error(error)
    }
    console.log(resp);
    this.setState({
      configSetting: {
        balancerComputeThreads: resp.balancerComputeThreads,
        emitBalancingStats: resp.emitBalancingStats,
        killAllDataSources: resp.killAllDataSources,
        killDataSourceWhitelist: resp.killDataSourceWhitelist,
        killPendingSegmentsSkipList: resp.killPendingSegmentsSkipList,
        maxSegmentsInNodeLoadingQueue: resp.maxSegmentsInNodeLoadingQueue,
        maxSegmentsToMove : resp.maxSegmentsToMove,
        mergeBytesLimit : resp.mergeBytesLimit,
        mergeSegmentsLimit : resp.mergeSegmentsLimit,
        millisToWaitBeforeDeleting : resp.millisToWaitBeforeDeleting,
        replicantLifetime: resp.replicantLifetime,
        replicationThrottleLimit: resp.replicationThrottleLimit
      }
    });
  }

  private saveClusterConfig(): void {
    const { onClose } = this.props;
    let newState: any = this.state.configSetting;
    const whiteList: any[] = newState["killDataSourceWhitelist"];
    const skipList: any[] = newState["killPendingSegmentsSkipList"];
    newState["killDataSourceWhitelist"] = newState["killDataSourceWhitelist"].join(",");
    newState["killPendingSegmentsSkipList"] = newState["killPendingSegmentsSkipList"].join(",");
    axios.post("/druid/coordinator/v1/config", newState, {
      headers:{
        "X-Druid-Author": this.state.configAuthor,
        "X-Druid-Comment": this.state.configComment
      }
    });
    newState["killDataSourceWhitelist"] = whiteList;
    newState["killPendingSegmentsSkipList"] = skipList;
    onClose();
  }

  render() {
    const { isOpen, onClose } = this.props;
    const { configSetting } = this.state;

    return <Dialog
      className="runtime-property-dialog"
      isOpen={ isOpen }
      onOpening={ () => {this.getClusterConfig();}}
      onClose={ onClose }
      title={"Edit cluster config"}
    >
      <div className={`dialog-body ${Classes.DIALOG_BODY}`}>
        <AutoForm
          fields={[
            {
              name: "balancerComputeThreads",
              type: "number"
            },
            {
              name: "emitBalancingStats",
              type: "boolean"
            },
            {
              name: "killAllDataSources",
              type: "boolean"
            },
            {
              name: "killDataSourceWhitelist",
              type: "string-array"
            },
            {
              name: "killPendingSegmentsSkipList",
              type: "string-array"
            },
            {
              name: "maxSegmentsInNodeLoadingQueue",
              type: "number"
            },
            {
              name: "maxSegmentsToMove",
              type: "number"
            },
            {
              name: "mergeBytesLimit",
              type: "size-bytes"
            },
            {
              name: "mergeSegmentsLimit",
              type: "number"
            },
            {
              name: "millisToWaitBeforeDeleting",
              type: "number"
            },
            {
              name: "replicantLifetime",
              type: "number"
            },
            {
              name: "replicationThrottleLimit",
              type: "number"
            }
          ]}
          model={configSetting}
          onChange={m => this.setState({ configSetting: m })}
        />
        <FormGroup label={"Who is making this change?"}>
          <InputGroup
            onChange={(e: any) => {this.setState({configAuthor: e.target.value})}}
          />
        </FormGroup>
        <FormGroup className={"config-comment"}>
          <InputGroup
            placeholder={"Please comment"}
            onChange={(e: any) => {this.setState({configComment: e.target.value})}}
            large={true}
          />
        </FormGroup>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button onClick={onClose}>Close</Button>
          <Button
            text="Save"
            onClick={() => this.saveClusterConfig()}
            intent={Intent.PRIMARY}
          />
        </div>
      </div>
    </Dialog>
  }
}
