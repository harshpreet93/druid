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

package io.druid.segment.incremental;

import io.druid.java.util.common.DateTimes;
import io.druid.java.util.common.StringUtils;
import io.druid.segment.IndexSpec;
import io.druid.segment.IndexableAdapter;
import io.druid.segment.Rowboat;
import io.druid.segment.data.BitmapValues;
import io.druid.segment.data.CompressionFactory;
import io.druid.segment.data.CompressionStrategy;
import io.druid.segment.data.ConciseBitmapSerdeFactory;
import io.druid.segment.data.IncrementalIndexTest;
import org.junit.Assert;
import org.junit.Test;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.function.Function;

public class IncrementalIndexAdapterTest
{
  private static final IndexSpec INDEX_SPEC = new IndexSpec(
      new ConciseBitmapSerdeFactory(),
      CompressionStrategy.LZ4,
      CompressionStrategy.LZ4,
      CompressionFactory.LongEncodingStrategy.LONGS
  );

  @Test
  public void testGetBitmapIndex() throws Exception
  {
    final long timestamp = System.currentTimeMillis();
    IncrementalIndex incrementalIndex = IncrementalIndexTest.createIndex(null);
    IncrementalIndexTest.populateIndex(timestamp, incrementalIndex);
    IndexableAdapter adapter = new IncrementalIndexAdapter(
        incrementalIndex.getInterval(),
        incrementalIndex,
        INDEX_SPEC.getBitmapSerdeFactory().getBitmapFactory()
    );
    String dimension = "dim1";
    for (int i = 0; i < adapter.getDimValueLookup(dimension).size(); i++) {
      BitmapValues bitmapValues = adapter.getBitmapValues(dimension, i);
      Assert.assertEquals(1, bitmapValues.size());
    }
  }

  @Test
  public void testGetRowsIterable() throws Exception
  {
    final long timestamp = System.currentTimeMillis();
    IncrementalIndex toPersist1 = IncrementalIndexTest.createIndex(null);
    IncrementalIndexTest.populateIndex(timestamp, toPersist1);

    final IndexableAdapter incrementalAdapter = new IncrementalIndexAdapter(
        toPersist1.getInterval(),
        toPersist1,
        INDEX_SPEC.getBitmapSerdeFactory()
                  .getBitmapFactory()
    );

    Iterable<Rowboat> boats = incrementalAdapter.getRows();
    List<Rowboat> boatList = new ArrayList<>();
    for (Rowboat boat : boats) {
      boatList.add(boat);
    }
    Assert.assertEquals(2, boatList.size());
    Assert.assertEquals(0, boatList.get(0).getRowNum());
    Assert.assertEquals(1, boatList.get(1).getRowNum());

    /* Iterate through the Iterable a few times, check that boat row numbers are correct afterwards */
    boatList = new ArrayList<>();
    for (Rowboat boat : boats) {
      boatList.add(boat);
    }
    boatList = new ArrayList<>();
    for (Rowboat boat : boats) {
      boatList.add(boat);
    }
    boatList = new ArrayList<>();
    for (Rowboat boat : boats) {
      boatList.add(boat);
    }
    boatList = new ArrayList<>();
    for (Rowboat boat : boats) {
      boatList.add(boat);
    }

    Assert.assertEquals(2, boatList.size());
    Assert.assertEquals(0, boatList.get(0).getRowNum());
    Assert.assertEquals(1, boatList.get(1).getRowNum());

  }

  @Test
  public void testGetRowsIterableNoRollup() throws Exception
  {
    final long timestamp = System.currentTimeMillis();
    IncrementalIndex toPersist1 = IncrementalIndexTest.createNoRollupIndex(null);
    IncrementalIndexTest.populateIndex(timestamp, toPersist1);
    IncrementalIndexTest.populateIndex(timestamp, toPersist1);
    IncrementalIndexTest.populateIndex(timestamp, toPersist1);


    ArrayList<Integer> dim1Vals = new ArrayList<>();
    for (IncrementalIndex.TimeAndDims row : toPersist1.getFacts().keySet()) {
      dim1Vals.add(((int[]) row.getDims()[0])[0]);
    }
    ArrayList<Integer> dim2Vals = new ArrayList<>();
    for (IncrementalIndex.TimeAndDims row : toPersist1.getFacts().keySet()) {
      dim2Vals.add(((int[]) row.getDims()[1])[0]);
    }

    final IndexableAdapter incrementalAdapter = new IncrementalIndexAdapter(
        toPersist1.getInterval(),
        toPersist1,
        INDEX_SPEC.getBitmapSerdeFactory()
                  .getBitmapFactory()
    );

    Iterator<Rowboat> rows = incrementalAdapter.getRows().iterator();
    List<String> rowStrings = new ArrayList<>();
    while (rows.hasNext()) {
      rowStrings.add(rows.next().toString());
    }

    Function<Integer, String> getExpected = (rowNumber) -> {
      if (rowNumber < 3) {
        return StringUtils.format(
            "Rowboat{timestamp=%s, dims=[[0], [0]], metrics=[1], comprisedRows={}}",
            DateTimes.utc(timestamp)
        );
      } else {
        return StringUtils.format(
            "Rowboat{timestamp=%s, dims=[[1], [1]], metrics=[1], comprisedRows={}}",
            DateTimes.utc(timestamp)
        );
      }
    };

    // without sorting, output would be
    //    RowPointer{indexNum=0, rowNumber=0, timestamp=1533347274588, dimensions={dim1=1, dim2=2}, metrics={count=1}}
    //    RowPointer{indexNum=0, rowNumber=1, timestamp=1533347274588, dimensions={dim1=3, dim2=4}, metrics={count=1}}
    //    RowPointer{indexNum=0, rowNumber=2, timestamp=1533347274588, dimensions={dim1=1, dim2=2}, metrics={count=1}}
    //    RowPointer{indexNum=0, rowNumber=3, timestamp=1533347274588, dimensions={dim1=3, dim2=4}, metrics={count=1}}
    //    RowPointer{indexNum=0, rowNumber=4, timestamp=1533347274588, dimensions={dim1=1, dim2=2}, metrics={count=1}}
    //    RowPointer{indexNum=0, rowNumber=5, timestamp=1533347274588, dimensions={dim1=3, dim2=4}, metrics={count=1}}
    // but with sorting, output should be
    //    RowPointer{indexNum=0, rowNumber=0, timestamp=1533347361396, dimensions={dim1=1, dim2=2}, metrics={count=1}}
    //    RowPointer{indexNum=0, rowNumber=1, timestamp=1533347361396, dimensions={dim1=1, dim2=2}, metrics={count=1}}
    //    RowPointer{indexNum=0, rowNumber=2, timestamp=1533347361396, dimensions={dim1=1, dim2=2}, metrics={count=1}}
    //    RowPointer{indexNum=0, rowNumber=3, timestamp=1533347361396, dimensions={dim1=3, dim2=4}, metrics={count=1}}
    //    RowPointer{indexNum=0, rowNumber=4, timestamp=1533347361396, dimensions={dim1=3, dim2=4}, metrics={count=1}}
    //    RowPointer{indexNum=0, rowNumber=5, timestamp=1533347361396, dimensions={dim1=3, dim2=4}, metrics={count=1}}

    Assert.assertEquals(6, rowStrings.size());
    for (int i = 0; i < 6; i++) {
      if (i % 2 == 0) {
        Assert.assertEquals(0, (long) dim1Vals.get(i));
        Assert.assertEquals(0, (long) dim2Vals.get(i));
      } else {
        Assert.assertEquals(1, (long) dim1Vals.get(i));
        Assert.assertEquals(1, (long) dim2Vals.get(i));
      }
      Assert.assertEquals(getExpected.apply(i), rowStrings.get(i));
    }
  }
}