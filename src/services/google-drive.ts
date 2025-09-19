
'use server';

import { google, type drive_v3 } from 'googleapis';
import { Readable } from 'stream';
import { createGoogleAuthClient } from './google-client';
import type { Order } from '@/app/dashboard/page';


let driveClient: drive_v3.Drive | undefined;

function getDriveClient(): drive_v3.Drive {
  if (driveClient) {
    return driveClient;
  }
  const authClient = createGoogleAuthClient(['https://www.googleapis.com/auth/drive']);
  driveClient = google.drive({ version: 'v3', auth: authClient });
  return driveClient;
}


async function findOrCreateFolder(name: string, parentId: string, drive: drive_v3.Drive): Promise<string> {
  const sanitizedName = name.trim().replace(/[/\\?%*:|"<>]/g, '-');
  if (!sanitizedName) {
    throw new Error("Folder name cannot be empty after sanitization.");
  }

  const query = `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${sanitizedName.replace(/'/g, "\\'")}' and trashed = false`;

  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  if (response.data.files && response.data.files.length > 0) {
    return response.data.files[0].id!;
  } else {
    const fileMetadata = {
      name: sanitizedName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    };
    const folder = await drive.files.create({
      resource: fileMetadata,
      fields: 'id',
      supportsAllDrives: true,
    });
    return folder.data.id!;
  }
}

export async function moveAndRenameFinalContract(params: {
  fileId: string;
  client: string;
  fileName: string;
  market: 'boise' | 'twin-falls';
  entryDate: Date;
}): Promise<{ id: string; webViewLink: string; webContentLink: string }> {
    const { market, entryDate, client, fileName } = params;
    const year = entryDate.getFullYear().toString();
    
    let targetRootFolderId: string | undefined;

    if (market === 'twin-falls') {
        targetRootFolderId = process.env.GOOGLE_DRIVE_TWIN_FALLS_FOLDER_ID;
        if (!targetRootFolderId) throw new Error('Twin Falls market is selected, but GOOGLE_DRIVE_TWIN_FALLS_FOLDER_ID is not configured in the .env file.');
    } else { // Default to Boise
        targetRootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        if (!targetRootFolderId) throw new Error('Boise market is selected, but GOOGLE_DRIVE_FOLDER_ID is not configured in the .env file.');
    }

    const drive = getDriveClient();

    const fileData = await drive.files.get({
        fileId: params.fileId,
        fields: 'parents',
        supportsAllDrives: true,
    });
    const previousParents = fileData.data.parents?.join(',') || '';

    const yearFolderId = await findOrCreateFolder(year, targetRootFolderId, drive);
    const clientFolderId = await findOrCreateFolder(client, yearFolderId, drive);

    try {
        const updatedFile = await drive.files.update({
            fileId: params.fileId,
            addParents: clientFolderId,
            removeParents: previousParents,
            resource: {
                name: fileName,
            },
            fields: 'id, webViewLink, webContentLink',
            supportsAllDrives: true,
        });
        if (!updatedFile.data.id || !updatedFile.data.webViewLink || !updatedFile.data.webContentLink) {
            throw new Error('Failed to get updated file details from Google Drive API response.');
        }
        return {
            id: updatedFile.data.id,
            webViewLink: updatedFile.data.webViewLink,
            webContentLink: updatedFile.data.webContentLink,
        };
    } catch (error: any) {
        console.error('Error moving/renaming file in Google Drive:', error);
        throw new Error(error.message || 'An unknown error occurred during file finalization.');
    }
}

export async function downloadDriveFile(params: { fileId: string }): Promise<string> {
  const drive = getDriveClient();
  try {
    const response = await drive.files.get(
      { fileId: params.fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' }
    );
    const buffer = Buffer.from(response.data as ArrayBuffer);
    return `data:application/pdf;base64,${buffer.toString('base64')}`;
  } catch (error: any) {
    console.error('Error downloading file from Google Drive:', error);
    throw new Error(error.message || 'An unknown error occurred during file download.');
  }
}

export async function updateContractInDrive(params: {
  fileId: string;
  mergedPdfDataUri: string;
}): Promise<void> {
  const drive = getDriveClient();
  const buffer = Buffer.from(params.mergedPdfDataUri.split(',')[1], 'base64');
  const stream = Readable.from(buffer);

  const media = {
    mimeType: 'application/pdf',
    body: stream,
  };

  try {
    await drive.files.update({
      fileId: params.fileId,
      media: media,
      supportsAllDrives: true,
    });
  } catch (error: any) {
    console.error('Error updating file in Google Drive:', error);
    throw new Error(error.message || 'An unknown error occurred during file update.');
  }
}

// Functions for the Smart Importer
export interface ImportableFile {
    fileId: string;
    fileName: string;
    clientName: string;
    year: string;
    sourceParentId: string;
}

export interface ClientFolderScan {
    clientName: string;
    yearFolders: {
        year: string;
        pdfs: ImportableFile[];
    }[];
}

async function listAll(drive: drive_v3.Drive, query: string, fields: string): Promise<drive_v3.Schema$File[]> {
    let allItems: drive_v3.Schema$File[] = [];
    let pageToken: string | undefined = undefined;

    do {
        const response = await drive.files.list({
            q: query,
            fields: `nextPageToken, files(${fields})`,
            pageToken: pageToken,
            pageSize: 100, // Process in chunks of 100
            orderBy: 'name',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
        });
        
        const files = Array.isArray(response.data.files) ? response.data.files : [];
        if (files.length > 0) {
            allItems = allItems.concat(files);
        }

        pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);
    return allItems;
}


export async function scanForImportableFiles(sourceFolderId: string, yearToScan: string): Promise<ClientFolderScan[]> {
    const drive = getDriveClient();
    
    // 1. Get all client folders directly under the source folder.
    const clientFoldersQuery = `'${sourceFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const clientFolders = await listAll(drive, clientFoldersQuery, 'id, name');

    const clientFolderScans: Promise<ClientFolderScan>[] = clientFolders.map(async (clientFolder) => {
        if (!clientFolder.id || !clientFolder.name) return { clientName: 'Unknown', yearFolders: [] };

        const clientScan: ClientFolderScan = {
            clientName: clientFolder.name,
            yearFolders: []
        };

        // 2. Inside each client folder, find the folder for the specified year.
        const yearFolderQuery = `'${clientFolder.id}' in parents and mimeType='application/vnd.google-apps.folder' and name='${yearToScan}' and trashed=false`;
        const yearFolders = await listAll(drive, yearFolderQuery, 'id, name');
        
        const targetYearFolder = yearFolders[0]; 
        if (targetYearFolder && targetYearFolder.id) {
            // 3. Inside the year folder, find all PDF files.
            const pdfQuery = `'${targetYearFolder.id}' in parents and mimeType='application/pdf' and trashed=false`;
            const pdfs = await listAll(drive, pdfQuery, 'id, name');

            clientScan.yearFolders.push({
                year: yearToScan,
                pdfs: pdfs.map(pdf => ({
                    fileId: pdf.id!,
                    fileName: pdf.name!,
                    clientName: clientFolder.name!,
                    year: yearToScan,
                    sourceParentId: targetYearFolder.id!,
                }))
            });
        }
        return clientScan;
    });

    return Promise.all(clientFolderScans);
}


export async function moveImportedFile(params: {
    fileId: string;
    client: string;
    year: string;
    fileName: string;
    market: 'boise' | 'twin-falls';
}): Promise<{ id: string; webViewLink: string; webContentLink: string }> {
    const { fileId, client, year, fileName, market } = params;

    let targetRootFolderId: string | undefined;
     if (market === 'twin-falls') {
        targetRootFolderId = process.env.GOOGLE_DRIVE_TWIN_FALLS_FOLDER_ID;
        if (!targetRootFolderId) throw new Error('Twin Falls market is selected, but GOOGLE_DRIVE_TWIN_FALLS_FOLDER_ID is not configured in the .env file.');
    } else {
        targetRootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        if (!targetRootFolderId) throw new Error('Boise market is selected, but GOOGLE_DRIVE_FOLDER_ID is not configured in the .env file.');
    }

    const drive = getDriveClient();
    
    const fileData = await drive.files.get({
        fileId: fileId,
        fields: 'parents',
        supportsAllDrives: true,
    });
    const previousParents = fileData.data.parents?.join(',') || '';

    const yearFolderId = await findOrCreateFolder(year, targetRootFolderId, drive);
    const clientFolderId = await findOrCreateFolder(client, yearFolderId, drive);

    const updatedFile = await drive.files.update({
        fileId: fileId,
        addParents: clientFolderId,
        removeParents: previousParents,
        resource: {
            name: fileName,
        },
        fields: 'id, webViewLink, webContentLink',
        supportsAllDrives: true,
    });

    if (!updatedFile.data.id || !updatedFile.data.webViewLink || !updatedFile.data.webContentLink) {
        throw new Error('Failed to get updated file details from Google Drive API after move.');
    }
    return {
        id: updatedFile.data.id,
        webViewLink: updatedFile.data.webViewLink,
        webContentLink: updatedFile.data.webContentLink,
    };
}


export async function archiveFile(params: {
  fileId: string;
  fileName: string;
}): Promise<{ id: string }> {
    const { fileId, fileName } = params;
    
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!rootFolderId) throw new Error('Root folder ID (GOOGLE_DRIVE_FOLDER_ID) is not configured.');

    const drive = getDriveClient();

    const fileData = await drive.files.get({
        fileId: fileId,
        fields: 'parents',
        supportsAllDrives: true,
    });
    const previousParents = fileData.data.parents?.join(',') || '';

    // Create a new "unmatched" folder inside the root if it doesn't exist
    const unmatchedFolderId = await findOrCreateFolder('unmatched', rootFolderId, drive);

    const updatedFile = await drive.files.update({
        fileId: fileId,
        addParents: unmatchedFolderId,
        removeParents: previousParents,
        resource: {
            name: fileName, // Keep the original filename
        },
        fields: 'id',
        supportsAllDrives: true,
    });

     if (!updatedFile.data.id) {
        throw new Error('Failed to get updated file details from Google Drive API after archive.');
    }

    return { id: updatedFile.data.id };
}

// Function for Market Correction Tool
export async function getFileParentIds(fileId: string): Promise<string[] | null> {
    const drive = getDriveClient();
    try {
        const response = await drive.files.get({
            fileId: fileId,
            fields: 'parents',
            supportsAllDrives: true,
        });
        return response.data.parents || null;
    } catch (error: any) {
        console.error(`Error getting parents for file ${fileId}:`, error);
        // Don't throw, just return null so the calling function can skip this file.
        return null;
    }
}
    

    
