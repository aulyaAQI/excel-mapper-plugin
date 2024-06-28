import {
  downloadFile,
  mapConfigToReadableConfig,
  getTableStructure,
  mapToAddRecord,
  postData,
  validateExcelFilesOnly,
  getParsedConfig,
  checkDuplicateFileNames,
  checkAlreadyPosted,
  getFileNamesAndExtensions,
} from './helper/kintone mobile.js';
import { readExcel } from './helper/excel.js';
import Swal from 'sweetalert2';

(function (PLUGIN_ID) {
  kintone.events.on('mobile.app.record.create.submit.success', async (e) => {
    const { record } = e;
    const thisRecId = record.$id.value;

    try {
      const config = kintone.plugin.app.getConfig(PLUGIN_ID);
      const parsedConfig = getParsedConfig(config);
      const readableConfig = mapConfigToReadableConfig(parsedConfig);

      const {
        destinationApp: normalizedDestinationApp,
        destinationExcelNameHolder: normalizedDestinationExcelNameHolder,
        destinationReferenceHolder: normalizedDestinationReferenceHolder,
        mapperList: normalizedMapperList,
        sourceAttachmentField: normalizedSourceAttachmentField,
      } = readableConfig;

      Swal.fire({
        title: `Processing ${record[normalizedSourceAttachmentField].value.length} file(s)...`,
        text: 'Please wait...',
        showConfirmButton: false,
        allowOutsideClick: () => !Swal.isLoading(),
        allowEscapeKey: false,
        allowEnterKey: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });
      const attachments = record[normalizedSourceAttachmentField].value;

      const downloadPromises = attachments.map(async (attachment) => {
        const fileKey = attachment.fileKey;
        const fileName = attachment.name;
        const downloadResp = await downloadFile(fileKey);

        return { downloadResp, fileName };
      });

      const [downloadResults, tableReferences] = await Promise.all([
        Promise.all(downloadPromises),
        getTableStructure(normalizedDestinationApp),
      ]);

      const readFilePromises = downloadResults.map((downloadResult) => {
        const { downloadResp, fileName } = downloadResult;
        return readExcel(downloadResp, fileName);
      });

      const readResults = await Promise.all(readFilePromises);

      const addRecords = readResults.map((excelFile) => {
        const { readableData, fileName } = excelFile;
        const addRecord = mapToAddRecord(
          normalizedMapperList,
          readableData,
          tableReferences,
          fileName,
          thisRecId,
          normalizedDestinationExcelNameHolder,
          normalizedDestinationReferenceHolder,
        );

        return { ...addRecord };
      });

      await postData(addRecords, normalizedDestinationApp);

      Swal.hideLoading();

      Swal.close();
      await Swal.fire({
        icon: 'success',
        title: 'Success',
        text: 'Data posted successfully!',
        timer: 2000,
        timerProgressBar: true,
      });
    } catch (error) {
      Swal.hideLoading();
      Swal.close();
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'An error occurred. Failed to post data. Please see the console for more details.',
      });
    }

    return e;
  });

  kintone.events.on('mobile.app.record.create.submit', async (e) => {
    const config = kintone.plugin.app.getConfig(PLUGIN_ID);
    const parsedConfig = getParsedConfig(config);

    const fileNamesAndExtensions = getFileNamesAndExtensions(parsedConfig);
    const fileNames = fileNamesAndExtensions.map((file) => file.fileName);

    const isExcelOnly = validateExcelFilesOnly(parsedConfig);

    if (!isExcelOnly) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Only Excel files are allowed.',
      });

      return false;
    }

    const duplicateFileNames = checkDuplicateFileNames(parsedConfig);

    if (duplicateFileNames.length > 0) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: `Duplicate file names found: ${duplicateFileNames.join(', ')}`,
      });

      return false;
    }

    if (fileNames.length === 0) {
      return e;
    }

    Swal.fire({
      title: 'Checking for already posted files...',
      text: 'Please wait...',
      allowOutsideClick: () => !Swal.isLoading(),
      didOpen: () => {
        Swal.showLoading();
      },
    });

    const alreadyPosted = await checkAlreadyPosted(parsedConfig, fileNames);
    Swal.hideLoading();

    if (alreadyPosted.length > 0) {
      Swal.update({
        icon: 'error',
        title: 'Error',
        html: `The following files have already been posted: <br> ${alreadyPosted.join(', ')}`,
      });

      return false;
    }

    Swal.close();

    return e;
  });
})(kintone.$PLUGIN_ID);
