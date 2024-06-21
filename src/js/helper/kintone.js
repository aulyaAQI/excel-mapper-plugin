import { KintoneRestAPIClient } from '@kintone/rest-api-client';
import { DateTime } from 'luxon';

export async function downloadFile(fileKey) {
  const client = new KintoneRestAPIClient();
  const downloadResp = client.file.downloadFile({ fileKey });

  return downloadResp;
}

export function mapConfigToReadableConfig(config) {
  let {
    destinationApp,
    destinationExcelNameHolder,
    destinationReferenceHolder,
    mapperList,
    sourceAttachmentField,
    sourceReferenceField,
  } = config;

  destinationApp = destinationApp.appId;
  destinationExcelNameHolder = destinationExcelNameHolder.code;
  destinationReferenceHolder = destinationReferenceHolder.code;
  sourceAttachmentField = sourceAttachmentField.code;
  mapperList = normalizeMapperList(mapperList);

  return {
    destinationApp,
    destinationExcelNameHolder,
    destinationReferenceHolder,
    mapperList,
    sourceAttachmentField,
    sourceReferenceField,
  };
}

function normalizeMapperList(mapperList) {
  return mapperList.map((mapper) => {
    const {
      endLine,
      fieldCode,
      fieldType,
      isTableField,
      parentTable,
      split,
      startLine,
    } = mapper;

    let { mapTo, mapFrom } = mapper;

    mapTo = mapTo?.code;

    mapFrom = {
      cellAddress: mapFrom.cellAddress,
      colNumber: mapFrom.colNumber,
      rowNumber: mapFrom.rowNumber,
    };

    let mapFromUntil = null;
    if (isTableField) {
      mapFromUntil = mapper.mapFromUntil;
      mapFromUntil = {
        cellAddress: mapFromUntil.cellAddress,
        colNumber: mapFromUntil.colNumber,
        rowNumber: mapFromUntil.rowNumber,
      };
    }

    return {
      endLine,
      fieldCode,
      fieldType,
      isTableField,
      mapFrom,
      mapFromUntil,
      mapTo,
      parentTable,
      split,
      startLine,
    };
  });
}

export async function getTableStructure(appId) {
  const client = new KintoneRestAPIClient();
  const respFormFields = await client.app.getFormFields({ app: appId });

  console.log({ respFormFields });

  const tablesOnlyArr = Object.keys(respFormFields.properties)
    .map((fieldCode) => {
      const field = respFormFields.properties[fieldCode];

      return field;
    })
    .filter((field) => field.type === 'SUBTABLE');

  console.log({ tablesOnlyArr });

  return tablesOnlyArr;
}

export function processData(excelFile, mapper) {
  console.log({ excelFile, mapper });

  const {
    mapFrom,
    mapFromUntil,
    split,
    startLine,
    endLine,
    fieldCode,
    isTableField,
    parentTable,
    fieldType,
  } = mapper;

  const returnedProps = {
    isTableField,
    parentTable,
    type: fieldType,
  };

  if (isTableField) {
    mapper.split = false;
    const filteredData = excelFile.filter(
      (cell) =>
        cell.rowNumber >= mapFrom.rowNumber &&
        cell.rowNumber <= mapFromUntil.rowNumber &&
        cell.colNumber === mapFrom.colNumber,
    );

    console.log({ filteredData });

    const mappedCellValueWithValues = filteredData
      .map((cell) => ({ cellValue: cell.cellValue, rowNumber: cell.rowNumber }))
      .filter((cell) => cell.cellValue);
    console.log({ mappedCellValueWithValues });
    return {
      code: fieldCode,
      valueRowPairs: mappedCellValueWithValues,
      ...returnedProps,
    };
  }

  const findRelatedCell = excelFile.find(
    (cell) => cell.cellAddress === mapFrom.cellAddress,
  );
  const cellValue = findRelatedCell?.cellValue;

  if (split) {
    const splitString = cellValue.split('\n');

    let joinString = splitString.slice(startLine - 1).join('\n');

    if (!startLine && !endLine) {
      joinString = splitString.join('\n');
    }

    if (!startLine && endLine) {
      joinString = splitString.slice(0, endLine).join('\n');
    }

    if (startLine && !endLine) {
      joinString = splitString.slice(startLine - 1).join('\n');
    }

    if (startLine && endLine) {
      joinString = splitString.slice(startLine - 1, endLine).join('\n');
    }

    return { code: fieldCode, value: joinString, ...returnedProps };
  }

  return { code: fieldCode, value: cellValue, ...returnedProps };
}

export function mapToAddRecord(
  normalizedMapperList,
  excelFile,
  tableReferences,
  fileName,
  thisRecId,
  normalizedDestinationExcelNameHolder,
  normalizedDestinationReferenceHolder,
) {
  const addRecord = {};

  const individuallyMappedMapper = normalizedMapperList.map((mapper) => {
    const processedData = processData(excelFile, mapper);
    // console.log({ processedValue });

    // addRecord[mapTo] = { value: null };
    return processedData;
  });

  const filteredTableData = individuallyMappedMapper
    .filter((mapper) => mapper.isTableField)
    .map((mapper) => {
      const { code, valueRowPairs, parentTable, type } = mapper;
      return {
        code,
        valueRowPairs,
        parentTable,
        type,
      };
    });

  const filteredNonTableData = individuallyMappedMapper
    .filter((mapper) => !mapper.isTableField)
    .map((mapper) => {
      const { code, value, type } = mapper;
      return {
        code,
        value,
        type,
      };
    });

  console.log({ individuallyMappedMapper });
  console.log({ filteredTableData });
  console.log({ filteredNonTableData });

  filteredNonTableData.forEach((data) => {
    mapNonTableWithTypeCheck(data, addRecord);
  });

  console.log({ addRecord });
  filteredTableData.forEach((data) => {
    mapTableWithTypeCheck(data, addRecord, tableReferences);
  });

  const mapParentOnly = filteredTableData.map((data) => {
    return data.parentTable;
  });

  const uniqueParentTables = [...new Set(mapParentOnly)];

  uniqueParentTables.forEach((parentTable) => {
    const parentTableData = addRecord[parentTable];
    const filteredParentTableData = parentTableData.value.filter(
      (row) => row !== null,
    );

    addRecord[parentTable].value = filteredParentTableData;
  });

  return {
    ...addRecord,
    [normalizedDestinationExcelNameHolder]: { value: fileName },
    [normalizedDestinationReferenceHolder]: { value: thisRecId },
  };
}

function mapNonTableWithTypeCheck(data, addRecord) {
  const { code, value, type } = data;

  if (type === 'SINGLE_LINE_TEXT' || type === 'MULTI_LINE_TEXT') {
    let usedValue = null;

    if (typeof value === 'number') {
      usedValue = value.toString();
    }

    if (typeof value === 'string') {
      usedValue = value;
    }

    addRecord[code] = { value: usedValue, type };
    return;
  }

  if (type === 'NUMBER') {
    let usedValue = null;

    if (typeof value === 'number') {
      usedValue = value.toString();
    }

    if (typeof value === 'string') {
      const parsedValue = parseFloat(value);
      if (!isNaN(parsedValue)) {
        usedValue = parsedValue.toString();
      }
    }

    addRecord[code] = { value: usedValue, type };
    return;
  }

  if (type === 'DATE') {
    let usedDate = null;

    if (typeof value === 'object') {
      const jsDate = DateTime.fromJSDate(value);
      if (jsDate.isValid) {
        usedDate = jsDate.toISODate();
      }
    }

    if (typeof value === 'string') {
      const fmtDate = DateTime.fromFormat(value, 'MM/dd/yy');
      if (fmtDate.isValid) {
        usedDate = fmtDate.toISODate();
      }
    }

    addRecord[code] = { value: usedDate, type };
    return;
  }

  addRecord[code] = { value, type };
}

function mapTableWithTypeCheck(data, addRecord) {
  const { code, valueRowPairs, parentTable, type } = data;

  if (!addRecord[parentTable]) {
    addRecord[parentTable] = { value: [] };
  }

  valueRowPairs.forEach((valueRowPair) => {
    if (!addRecord[parentTable].value[valueRowPair.rowNumber]) {
      addRecord[parentTable].value[valueRowPair.rowNumber] = {
        value: {},
      };
    }

    if (!addRecord[parentTable].value[valueRowPair.rowNumber].value[code]) {
      console.log({ code }, 'no code prop');
      addRecord[parentTable].value[valueRowPair.rowNumber].value[code] = {
        value: valueRowPair.cellValue,
        type,
      };
    }

    addRecord[parentTable].value[valueRowPair.rowNumber].value[code].value =
      valueRowPair.cellValue;
  });
}

export async function postData(addRecords, appId) {
  const client = new KintoneRestAPIClient();
  const resp = await client.record.addRecords({
    app: appId,
    records: addRecords,
  });

  return resp;
}
