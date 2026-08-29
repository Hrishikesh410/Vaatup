import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { createId } from './id';

/**
 * Where receipt photos live.
 *
 * The image picker hands back a URI in a cache location the system is free to
 * clear, so a receipt attached today could be a broken image next month. Every
 * receipt is copied into the app's document directory, which is backed up and
 * only removed when the app is uninstalled.
 */

const RECEIPTS_FOLDER = 'receipts';

function extensionOf(uri: string): string {
  const withoutQuery = uri.split('?')[0];
  const lastDot = withoutQuery.lastIndexOf('.');
  const extension = lastDot === -1 ? '' : withoutQuery.slice(lastDot + 1).toLowerCase();
  return /^[a-z0-9]{1,5}$/.test(extension) ? extension : 'jpg';
}

/**
 * Copies a picked image into permanent storage and returns the stored URI.
 *
 * On web there is no document directory to copy into — the picker's blob URL is
 * all there is — so the original is returned unchanged.
 */
export async function storeReceipt(pickedUri: string): Promise<string> {
  if (Platform.OS === 'web') return pickedUri;

  const folder = new Directory(Paths.document, RECEIPTS_FOLDER);
  if (!folder.exists) folder.create({ intermediates: true });

  const destination = new File(folder, `${createId('receipt')}.${extensionOf(pickedUri)}`);
  await new File(pickedUri).copy(destination);
  return destination.uri;
}

/**
 * Deletes a stored receipt, ignoring one that has already gone.
 *
 * Receipts outside the app's own folder are left alone: those URIs point at the
 * user's photo library, which is not ours to delete from.
 */
export async function deleteReceipt(uri: string): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!uri.includes(`/${RECEIPTS_FOLDER}/`)) return;

  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // A receipt that cannot be deleted is not worth failing an edit over.
  }
}
