/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

package org.apache.druid.segment;

import com.google.common.collect.Collections2;
import com.google.common.io.Files;
import com.google.common.primitives.Ints;
import org.apache.druid.guice.annotations.PublicApi;
import org.apache.druid.java.util.common.IOE;
import org.apache.druid.timeline.DataSegment;

import javax.annotation.Nullable;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Collection;

/**
 * Utility methods useful for implementing deep storage extensions.
 */
@PublicApi
public class SegmentUtils
{
  public static int getVersionFromDir(File inDir) throws IOException
  {
    File versionFile = new File(inDir, "version.bin");
    if (versionFile.exists()) {
      return Ints.fromByteArray(Files.toByteArray(versionFile));
    }

    final File indexFile = new File(inDir, "index.drd");
    int version;
    if (indexFile.exists()) {
      try (InputStream in = new FileInputStream(indexFile)) {
        version = in.read();
      }
      return version;
    }

    throw new IOE("Invalid segment dir [%s]. Can't find either of version.bin or index.drd.", inDir);
  }

  /**
   * Returns an object whose toString() returns a String with identifiers of the given segments, comma-separated. Useful
   * for log messages. Not useful for anything else, because this doesn't take special effort to escape commas that
   * occur in identifiers (not common, but could potentially occur in a datasource name).
   */
  @Nullable
  public static Object commaSeparatedIdentifiers(@Nullable final Collection<DataSegment> segments)
  {
    if (segments == null || segments.isEmpty()) {
      return null;
    }
    // Lazy, to avoid preliminary string creation if logging level is turned off
    return Collections2.transform(segments, DataSegment::getId);
  }

  private SegmentUtils()
  {
    // no instantiation
  }
}
