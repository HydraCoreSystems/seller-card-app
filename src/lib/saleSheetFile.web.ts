import * as DocumentPicker from 'expo-document-picker';
import type { SaleSheet } from '../core/saleSheet';
import { writeXlsx } from '../core/xlsx';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const SHEET_TYPES = [XLSX_MIME, 'text/csv', '.csv', '.xlsx'];

export async function shareSaleSheet(name: string, sheet: SaleSheet, sheetName: string): Promise<void> {
  const bytes = writeXlsx(sheet.rows, sheetName, sheet.layout);
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: XLSX_MIME }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function pickSheetBytes(): Promise<Uint8Array | null> {
  const picked = await DocumentPicker.getDocumentAsync({ type: SHEET_TYPES, base64: false });
  if (picked.canceled || !picked.assets?.length) return null;
  const res = await fetch(picked.assets[0].uri);
  return new Uint8Array(await res.arrayBuffer());
}
