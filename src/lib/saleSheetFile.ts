import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SaleSheet } from '../core/saleSheet';
import { writeXlsx } from '../core/xlsx';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Types the picker offers. A Google Sheet picked from Drive comes through as .xlsx. */
export const SHEET_TYPES = [XLSX_MIME, 'text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'text/plain'];

/** Writes the sheet as one .xlsx file and opens the share sheet, Google Drive included. */
export async function shareSaleSheet(name: string, sheet: SaleSheet, sheetName: string): Promise<void> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(writeXlsx(sheet.rows, sheetName, sheet.layout));
  await Sharing.shareAsync(file.uri, { mimeType: XLSX_MIME, UTI: 'org.openxmlformats.spreadsheetml.sheet', dialogTitle: name });
}

/** The bytes of a sheet the seller picks, or null if they back out. */
export async function pickSheetBytes(): Promise<Uint8Array | null> {
  const picked = await DocumentPicker.getDocumentAsync({ type: SHEET_TYPES, copyToCacheDirectory: true });
  if (picked.canceled || !picked.assets?.length) return null;
  return new File(picked.assets[0].uri).bytes();
}
