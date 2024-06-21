import {downloadFile, mapConfigToReadableConfig, getTableStructure, mapToAddRecord, postData} from './helper/kintone.js';
import {readExcel} from './helper/excel.js';

(function (PLUGIN_ID) {
  kintone.events.on('app.record.create.submit.success', async (e) => {
    const {record} = e;
    const thisRecId = record.$id.value;

    const config = kintone.plugin.app.getConfig(PLUGIN_ID);

    const destinationApp = JSON.parse(config.destinationApp);
    const destinationExcelNameHolder = JSON.parse(config.destinationExcelNameHolder);
    const destinationReferenceHolder = JSON.parse(config.destinationReferenceHolder);
    const mapperList = JSON.parse(config.mapperList);
    const sourceAttachmentField = JSON.parse(config.sourceAttachmentField);
    const sourceReferenceField = config.sourceReferenceField;

    const parsedConfig = {
      destinationApp,
      destinationExcelNameHolder,
      destinationReferenceHolder,
      mapperList,
      sourceAttachmentField,
      sourceReferenceField,
    };
    console.log({parsedConfig});

    const readableConfig = mapConfigToReadableConfig(parsedConfig);

    console.log({readableConfig});

    const {
      destinationApp: normalizedDestinationApp,
      destinationExcelNameHolder: normalizedDestinationExcelNameHolder,
      destinationReferenceHolder: normalizedDestinationReferenceHolder,
      mapperList: normalizedMapperList,
      sourceAttachmentField: normalizedSourceAttachmentField,
    } = readableConfig;

    const attachments = record[normalizedSourceAttachmentField].value;

    const downloadPromises = attachments.map(async (attachment) => {
      console.log({attachment});
      const fileKey = attachment.fileKey;
      const fileName = attachment.name;
      const downloadResp = await downloadFile(fileKey);

      return {downloadResp, fileName};
    });

    const [downloadResults, tableReferences] = await Promise.all([Promise.all(downloadPromises), getTableStructure(normalizedDestinationApp)]);
    console.log({tableReferences});

    const readFilePromises = downloadResults.map((downloadResult) => {
      const {downloadResp, fileName} = downloadResult;
      return readExcel(downloadResp, fileName);
    });

    const readResults = await Promise.all(readFilePromises);

    console.log({normalizedMapperList});
    console.log({readResults});

    const addRecords = readResults.map((excelFile) => {
      const {readableData, fileName} = excelFile;
      const addRecord = mapToAddRecord(
        normalizedMapperList,
        readableData,
        tableReferences,
        fileName,
        thisRecId,
        normalizedDestinationExcelNameHolder,
        normalizedDestinationReferenceHolder,
      );

      return {...addRecord};
    });

    console.log({addRecords});

    const postResult = await postData(addRecords, normalizedDestinationApp);

    console.log({postResult});

    return e;
  });
})(kintone.$PLUGIN_ID);
