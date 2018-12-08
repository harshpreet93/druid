/*
 * Licensed to Metamarkets Group Inc. (Metamarkets) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. Metamarkets licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

package io.druid.testing;

import java.util.Map;

/**
 */
public interface IntegrationTestingConfig
{
  String getCoordinatorUrl();

  String getCoordinatorTLSUrl();

  String getIndexerUrl();

  String getIndexerTLSUrl();

  String getRouterUrl();

  String getRouterTLSUrl();

  String getPermissiveRouterUrl();

  String getPermissiveRouterTLSUrl();

  String getNoClientAuthRouterUrl();

  String getNoClientAuthRouterTLSUrl();

  String getBrokerUrl();

  String getBrokerTLSUrl();

  String getCustomCertCheckRouterUrl();

  String getCustomCertCheckRouterTLSUrl();

  String getHistoricalUrl();

  String getHistoricalTLSUrl();

  String getMiddleManagerHost();

  String getZookeeperHosts();

  default String getZookeeperInternalHosts()
  {
    return getZookeeperHosts();
  }

  String getKafkaHost();

  default String getKafkaInternalHost()
  {
    return getKafkaHost();
  }

  String getProperty(String prop);

  String getUsername();

  String getPassword();

  Map<String, String> getProperties();

  boolean manageKafkaTopic();
}