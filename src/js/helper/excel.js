import * as ExcelJS from 'exceljs';

export async function readExcel(file, fileName) {
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(file);
  } catch (error) {
    console.log({ error });
  }

  const worksheet = workbook.getWorksheet(1);

  const readableData = mapWorkSheetToReadableData(worksheet);

  return { readableData, fileName };
}

function mapWorkSheetToReadableData(worksheet) {
  const mapped = [];
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
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
