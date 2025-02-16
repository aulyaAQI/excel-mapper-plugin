import {KintoneRestAPIClient} from '@kintone/rest-api-client';
import {DateTime} from 'luxon';

/**
 * Parses the configuration object and returns a new object with parsed values.
 * @param {Object} config - The configuration object.
 * @returns {Object} - The new object with parsed values.
 */
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

/**
 * Downloads a file from Kintone using the specified file key.
 * @param {string} fileKey - The key of the file to be downloaded.
 * @returns {Promise<Object>} - A promise that resolves to the download response object.
 */
export async function downloadFile(fileKey) {
  const client = new KintoneRestAPIClient();
  const downloadResp = client.file.downloadFile({fileKey});

  return downloadResp;
}

export function mapConfigToReadableConfig(config) {
  let {destinationApp, destinationExcelNameHolder, destinationReferenceHolder, mapperList, sourceAttachmentField, sourceReferenceField} = config;

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

/**
 * Normalizes the mapper list by transforming the properties of each mapper object.
 * @param {Array<Object>} mapperList - The list of mapper objects to be normalized.
 * @returns {Array<Object>} - The normalized mapper list.
 */
function normalizeMapperList(mapperList) {
  return mapperList.map((mapper) => {
    const {endLine, fieldCode, fieldType, isTableField, parentTable, split, startLine} = mapper;

    let {mapTo, mapFrom} = mapper;

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

/**
 * Retrieves the structure of a table in a Kintone app.
 * @param {number} appId - The ID of the Kintone app.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of table structures.
 */
export async function getTableStructure(appId) {
  const client = new KintoneRestAPIClient();
  const respFormFields = await client.app.getFormFields({app: appId});

  const tablesOnlyArr = Object.keys(respFormFields.properties)
    .map((fieldCode) => {
      const field = respFormFields.properties[fieldCode];

      return field;
    })
    .filter((field) => field.type === 'SUBTABLE');

  return tablesOnlyArr;
}

/**
 * Processes the data from an Excel file based on the provided mapper.
 * @param {Array} excelFile - The Excel file data.
 * @param {Object} mapper - The mapper object containing mapping instructions.
 * @returns {Object} - The processed data object.
 */
export function processData(excelFile, mapper) {
  const {mapFrom, mapFromUntil, split, startLine, endLine, fieldCode, isTableField, parentTable, fieldType} = mapper;

  const returnedProps = {
    isTableField,
    parentTable,
    type: fieldType,
  };

  if (isTableField) {
    mapper.split = false;
    const filteredData = excelFile.filter(
      (cell) => cell.rowNumber >= mapFrom.rowNumber && cell.rowNumber <= mapFromUntil.rowNumber && cell.colNumber === mapFrom.colNumber,
    );

    const mappedCellValueWithValues = filteredData
      .map((cell) => ({cellValue: cell.cellValue, rowNumber: cell.rowNumber}))
      .filter((cell) => cell.cellValue);
    return {
      code: fieldCode,
      valueRowPairs: mappedCellValueWithValues,
      ...returnedProps,
    };
  }

  const findRelatedCell = excelFile.find((cell) => cell.cellAddress === mapFrom.cellAddress);
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

    return {code: fieldCode, value: joinString, ...returnedProps};
  }

  return {code: fieldCode, value: cellValue, ...returnedProps};
}

/**
 * Maps the data from an Excel file to a kintone record and returns the mapped record object.
 *
 * @param {Array} normalizedMapperList - The list of normalized mappers.
 * @param {Object} excelFile - The Excel file object.
 * @param {Object} tableReferences - The table references object.
 * @param {string} fileName - The name of the Excel file.
 * @param {string} thisRecId - The ID of the current kintone record.
 * @param {string} normalizedDestinationExcelNameHolder - The normalized destination Excel name holder.
 * @param {string} normalizedDestinationReferenceHolder - The normalized destination reference holder.
 * @returns {Object} - The mapped record object.
 */
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
      const {code, valueRowPairs, parentTable, type} = mapper;
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
      const {code, value, type} = mapper;
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
    const filteredParentTableData = parentTableData.value.filter((row) => row !== null);

    addRecord[parentTable].value = filteredParentTableData;
  });

  return {
    ...addRecord,
    [normalizedDestinationExcelNameHolder]: {value: fileName},
    [normalizedDestinationReferenceHolder]: {value: thisRecId},
  };
}

/**
 * Maps non-table field data with type checking.
 *
 * @param {object} data - The data object containing code, value, and type properties.
 * @param {object} addRecord - The addRecord object to store the mapped data.
 * @returns {void}
 */
function mapNonTableWithTypeCheck(data, addRecord) {
  const {code, value, type} = data;

  if (type === 'SINGLE_LINE_TEXT' || type === 'MULTI_LINE_TEXT') {
    let usedValue = null;

    if (typeof value === 'number') {
      usedValue = value.toString();
    }

    if (typeof value === 'string') {
      usedValue = value;
    }

    addRecord[code] = {value: usedValue, type};
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

    addRecord[code] = {value: usedValue, type};
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

    addRecord[code] = {value: usedDate, type};
    return;
  }

  addRecord[code] = {value, type};
}

/**
 * Maps table data with type checking and adds it to the `addRecord` object.
 * @param {Object} data - The data to be mapped.
 * @param {Object} addRecord - The object to which the mapped data will be added.
 */
function mapTableWithTypeCheck(data, addRecord) {
  const {code, valueRowPairs, parentTable, type} = data;

  if (!addRecord[parentTable]) {
    addRecord[parentTable] = {value: []};
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

    addRecord[parentTable].value[valueRowPair.rowNumber].value[code].value = valueRowPair.cellValue;
  });
}

/**
 * Posts data to a Kintone app.
 * @param {Array} addRecords - The records to be added.
 * @param {number} appId - The ID of the Kintone app.
 * @returns {Promise<Object>} - A promise that resolves to the response from Kintone.
 */
export async function postData(addRecords, appId) {
  const client = new KintoneRestAPIClient();
  const resp = await client.record.addRecords({
    app: appId,
    records: addRecords,
  });

  return resp;
}

/**
 * Retrieves the file names and extensions of attachments based on the parsed configuration.
 *
 * @param {Object} parsedConfig - The parsed configuration object.
 * @returns {Array} An array of objects containing the file name and file extension.
 */
export function getFileNamesAndExtensions(parsedConfig) {
  const {sourceAttachmentField} = parsedConfig;
  const sourceAttachmentFieldLabel = sourceAttachmentField.label;
  const spanElements = document.querySelectorAll('.control-label-text-gaia');

  const attachmentChildrenArr = Array.from(spanElements);
  let attachmentFieldLabelElement;

  attachmentChildrenArr.forEach((child) => {
    if (child.innerText === sourceAttachmentFieldLabel) {
      attachmentFieldLabelElement = child;
    }
  });

  const attachmentFieldLabelDiv = attachmentFieldLabelElement.parentElement;
  const attachmentContainer = attachmentFieldLabelDiv.nextSibling;
  const fileListContainer = attachmentContainer.querySelector('.input-file-filelist-list-cybozu');

  const fileNameDivElements = fileListContainer.querySelectorAll('.plupload_file_name');

  const fileNameDivList = Array.from(fileNameDivElements);
  const fileNamesAndExtensions = fileNameDivList.map((fileNameDiv) => {
    const fileName = fileNameDiv.innerText;
    const fileExtension = fileName.split('.').pop();

    return {fileName, fileExtension};
  });

  return fileNamesAndExtensions;
}

/**
 * Validates if the parsed configuration contains only Excel files.
 *
 * @param {Object[]} parsedConfig - The parsed configuration object.
 * @returns {boolean} - Returns true if all file extensions are allowed Excel extensions, otherwise false.
 */
export function validateExcelFilesOnly(parsedConfig) {
  const fileNamesAndExtensions = getFileNamesAndExtensions(parsedConfig);
  const fileExtensions = fileNamesAndExtensions.map(({fileExtension}) => fileExtension);

  const allowedExtensions = ['xls', 'xlsx'];

  return fileExtensions.every((ext) => allowedExtensions.includes(ext));
}

/**
 * Checks for duplicate file names in the parsed configuration.
 * @param {Object[]} parsedConfig - The parsed configuration object.
 * @returns {string[]} - An array of duplicate file names.
 */
export function checkDuplicateFileNames(parsedConfig) {
  const fileNamesAndExtensions = getFileNamesAndExtensions(parsedConfig);
  const fileNames = fileNamesAndExtensions.map(({fileName}) => fileName);

  const duplicateFileNames = fileNames.filter((fileName, index) => {
    return fileNames.indexOf(fileName) !== index;
  });

  return duplicateFileNames;
}

/**
 * Checks if the given file names have already been posted in the destination app.
 * @param {Object} parsedConfig - The parsed configuration object.
 * @param {string[]} fileNames - An array of file names to check.
 * @returns {string[]} - An array of file names that have already been posted.
 */
export async function checkAlreadyPosted(parsedConfig, fileNames) {
  const {destinationApp, destinationExcelNameHolder} = parsedConfig;
  console.log({destinationApp});

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

  console.log({resp});

  const records = resp.records;

  const alreadyPostedFileNames = [];
  if (resp.totalCount > 0) {
    records.forEach((record) => {
      alreadyPostedFileNames.push(record[destinationExcelNameHolder.code].value);
    });
  }

  return alreadyPostedFileNames;
}
