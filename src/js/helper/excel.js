import * as ExcelJS from 'exceljs';

/**
 * Reads an Excel file and returns the data from the first worksheet.
 * @param {File} file - The Excel file to read.
 * @param {string} fileName - The name of the Excel file.
 * @returns {Promise<{ readableData: any, fileName: string }>} - A promise that resolves to an object containing the readable data from the Excel file and the file name.
 */
export async function readExcel(file, fileName) {
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(file);
  } catch (error) {
    console.log({error});
  }

  const worksheet = workbook.getWorksheet(1);

  const readableData = mapWorkSheetToReadableData(worksheet);

  return {readableData, fileName};
}

/**
 * Maps a worksheet to readable data.
 *
 * @param {Worksheet} worksheet - The worksheet to map.
 * @returns {Array} An array of mapped data objects.
 */
function mapWorkSheetToReadableData(worksheet) {
  const mapped = [];
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell({includeEmpty: true}, (cell, colNumber) => {
      const cellAddress = cell.address;
      const cellValue = mapCellValue(cell);

      mapped.push({
        rowNumber,
        cellValue,
        cellAddress,
        colNumber,
      });
    });
  });

  return mapped;
}

/**
 * Maps the value of a cell to a simplified format.
 * @param {object} cell - The cell object to map the value from.
 * @returns {any} The mapped cell value.
 */
function mapCellValue(cell) {
  let cellValue = cell.value;

  if (typeof cellValue === 'object') {
    if (cellValue?.richText) {
      cellValue = cellValue.richText.map((part) => part.text).join('');
    }

    if (cellValue?.formula) {
      cellValue = cellValue?.result;
    }

    if (cellValue?.sharedFormula) {
      cellValue = cellValue?.result;
    }
  }

  return cellValue;
}
