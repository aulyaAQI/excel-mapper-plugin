import { KintoneRestAPIClient } from '@kintone/rest-api-client';
import { DateTime } from 'luxon';

export function getParsedConfig(config) {
  return Object.keys(config).reduce((acc, key) => {
    try {
      acc[key] = JSON.parse(config[key]);
    } catch (e) {
      acc[key] = config[key];
    }
    return acc;
  }, {});
}

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

  const tablesOnlyArr = Object.keys(respFormFields.properties)
    .map((fieldCode) => {
      const field = respFormFields.properties[fieldCode];

      return field;
    })
    .filter((field) => field.type === 'SUBTABLE');

  return tablesOnlyArr;
}

export function processData(excelFile, mapper) {
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

    const mappedCellValueWithValues = filteredData
      .map((cell) => ({ cellValue: cell.cellValue, rowNumber: cell.rowNumber }))
      .filter((cell) => cell.cellValue);
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

  filteredNonTableData.forEach((data) => {
    mapNonTableWithTypeCheck(data, addRecord);
  });

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

export function getFileNamesAndExtensions(parsedConfig) {
  const { sourceAttachmentField } = parsedConfig;
  const sourceAttachmentFieldLabel = sourceAttachmentField.label;
  const spanElements = document.querySelectorAll('.control-label-gaia');

  const attachmentChildrenArr = Array.from(spanElements);
  let attachmentFieldLabelElement;

  attachmentChildrenArr.forEach((child) => {
    if (child.innerText === sourceAttachmentFieldLabel) {
      attachmentFieldLabelElement = child;
    }
  });

  const parentDiv = attachmentFieldLabelElement.parentElement;
  const fileListContainer = parentDiv.querySelector('.forms-files-list-gaia');

  const fileNameDivElements = fileListContainer.querySelectorAll(
    '.forms-file-preview-caption-name-gaia',
  );

  const fileNameDivList = Array.from(fileNameDivElements);
  const fileNamesAndExtensions = fileNameDivList.map((fileNameDiv) => {
    const fileName = fileNameDiv.innerText;
    const fileExtension = fileName.split('.').pop();

    return { fileName, fileExtension };
  });

  return fileNamesAndExtensions;
}

export function validateExcelFilesOnly(parsedConfig) {
  const fileNamesAndExtensions = getFileNamesAndExtensions(parsedConfig);
  const fileExtensions = fileNamesAndExtensions.map(
    ({ fileExtension }) => fileExtension,
  );

  const allowedExtensions = ['xls', 'xlsx'];

  return fileExtensions.every((ext) => allowedExtensions.includes(ext));
}

export function checkDuplicateFileNames(parsedConfig) {
  const fileNamesAndExtensions = getFileNamesAndExtensions(parsedConfig);
  const fileNames = fileNamesAndExtensions.map(({ fileName }) => fileName);

  const duplicateFileNames = fileNames.filter((fileName, index) => {
    return fileNames.indexOf(fileName) !== index;
  });

  return duplicateFileNames;
}

export async function checkAlreadyPosted(parsedConfig, fileNames) {
  const { destinationApp, destinationExcelNameHolder } = parsedConfig;
  console.log({ destinationApp });

  const client = new KintoneRestAPIClient();

  const queryFileNames = fileNames.map((fileName) => {
    return `"${fileName}"`;
  });

  const query = `${destinationExcelNameHolder.code} in (${queryFileNames.join(',')})`;

  const resp = await client.record.getRecords({
    app: destinationApp.appId,
    fields: [destinationExcelNameHolder.code],
    query,
    totalCount: true,
  });

  console.log({ resp });

  const records = resp.records;

  const alreadyPostedFileNames = [];
  if (resp.totalCount > 0) {
    records.forEach((record) => {
      alreadyPostedFileNames.push(
        record[destinationExcelNameHolder.code].value,
      );
    });
  }

  return alreadyPostedFileNames;
}
