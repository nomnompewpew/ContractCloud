
'use server';

import { searchSalespeople } from '@/ai/flows/search-salespeople';
import { extractContractDetails } from '@/ai/flows/extract-contract-details';
import { extractContractDate } from '@/ai/flows/extract-contract-date';
import { generateDashboardInsights } from '@/ai/flows/generate-dashboard-insights';
import { moveAndRenameFinalContract, updateContractInDrive, downloadDriveFile, scanForImportableFiles, moveImportedFile, archiveFile, getFileParentIds } from '@/services/google-drive';
import { mergeFiles } from '@/services/pdf-merger';
import { createOrder, updateOrder, deleteOrder, deleteOrders, bulkUpdateOrders, appendOrderModification, getPagedFixableOrders, countFixableOrders as countFixableOrdersInDb, getOrderByPdfId, countOrdersByDate as countOrdersByDateInDb, getPagedOrdersByDate, deleteOrderByIdAndCollection, findMarketMismatches, getOrderById, getDashboardData, getPagedOrders } from '@/services/firestore';
import type { Order, SalespersonInfo } from './dashboard/page';
import { Readable } from 'stream';
import { google } from 'googleapis';
import { createGoogleAuthClient } from '@/services/google-client';
import { parse } from 'date-fns';
import type { DashboardData } from '@/services/firestore';

function getErrorMessage(error: any, context: string): string {
    const defaultMessage = `An unexpected error occurred during ${context}.`;
    if (!error) return defaultMessage;

    const errorMessage = error.message || JSON.stringify(error);
    
    if (errorMessage.toLowerCase().includes('api key') || errorMessage.toLowerCase().includes('credential')) {
        return `Operation failed. Please check if your GOOGLE_API_KEY or Service Account credentials are configured correctly in your .env file.`;
    }
    
    if (errorMessage.toLowerCase().includes('billing') || errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('resource has been exhausted')) {
        return `Operation failed due to a quota issue. Your project may be exceeding the request limits. Please check the quotas for both the "Vertex AI API" and the "Generative Language API" in your Google Cloud Console to confirm. It may take some time for billing changes to apply.`;
    }

    if (errorMessage.toLowerCase().includes('permission denied') || errorMessage.includes('403')) {
        return `Permission denied. The service account may not have the required permissions for Google Drive or other services.`;
    }

    if (errorMessage.toLowerCase().includes('folder id')) {
        return `Configuration error: A required Google Drive folder ID is missing from your .env file. Please check for GOOGLE_DRIVE_FOLDER_ID, GOOGLE_DRIVE_TWIN_FALLS_FOLDER_ID, or GOOGLE_DRIVE_PENDING_FOLDER_ID.`;
    }

    // Return the raw error message if it's not one of the common ones.
    return errorMessage;
}


export async function searchSalespeopleAction(query: string) {
    try {
        const result = await searchSalespeople({ query });
        return { success: true, data: result };
    } catch (error: any) {
        console.error('Error searching salespeople:', error);
        return { success: false, error: getErrorMessage(error, 'searching salespeople') };
    }
}

export async function extractContractDetailsAction(pdfDataUri: string) {
    try {
        const result = await extractContractDetails({ contractPdf: pdfDataUri });
        return { success: true, data: result };
    } catch (error: any) {
        console.error('Error extracting contract details:', error);
        return { success: false, error: getErrorMessage(error, 'contract scanning') };
    }
}

async function uploadToPendingFolder(params: {
    mergedPdfDataUri: string;
}): Promise<{ id: string; webViewLink: string; }> {
    if (!process.env.GOOGLE_DRIVE_PENDING_FOLDER_ID) {
        throw new Error('The GOOGLE_DRIVE_PENDING_FOLDER_ID is not configured in the .env file.');
    }
    const drive = createGoogleAuthClient(['https://www.googleapis.com/auth/drive']);
    const driveService = google.drive({ version: 'v3', auth: drive });
    
    const fileName = `pending_${new Date().toISOString()}.pdf`;
    const buffer = Buffer.from(params.mergedPdfDataUri.split(',')[1], 'base64');
    
    const fileMetadata = {
        name: fileName,
        parents: [process.env.GOOGLE_DRIVE_PENDING_FOLDER_ID],
    };

    const media = {
        mimeType: 'application/pdf',
        body: Readable.from(buffer),
    };

    try {
        const file = await driveService.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, webViewLink',
            supportsAllDrives: true,
        });

        if (!file.data.id || !file.data.webViewLink) {
            throw new Error('Failed to get file details from Google Drive API response.');
        }

        // Grant viewer permissions to anyone with the link to ensure preview works.
        // This is safe as the file is temporary and has an obscure name.
        await driveService.permissions.create({
            fileId: file.data.id,
            requestBody: {
                role: 'reader',
                type: 'anyone'
            },
            supportsAllDrives: true,
        });

        return {
            id: file.data.id,
            webViewLink: file.data.webViewLink,
        };
    } catch (error: any) {
        console.error('Error uploading temporary file to Google Drive:', error);
        throw new Error(error.message || 'An unknown error occurred during temporary file upload.');
    }
}


export async function mergeAndPreviewAction(files: { dataUri: string; name: string; type: string }[]) {
    try {
        const filesToMerge = files.map(file => ({ ...file, mimeType: file.type }));
        const mergedPdfDataUri = await mergeFiles(filesToMerge);
        if (!mergedPdfDataUri) {
            throw new Error('File merging returned no data.');
        }

        const uploadResult = await uploadToPendingFolder({ mergedPdfDataUri });

        if (!uploadResult.id || !uploadResult.webViewLink) {
            throw new Error('File upload to Google Drive failed.');
        }

        return { success: true, data: { ...uploadResult, mergedPdfDataUri } };
    } catch (error: any) {
        console.error('Error in merge and preview action:', error);
        return { success: false, error: `Failed to prepare preview. ${getErrorMessage(error, 'file processing')}` };
    }
}


export async function submitFinalContractAction(params: {
    values: {
        client: string;
        agency: string;
        contractNumber: string;
        estimateNumber?: string;
        stations: string[];
        market: 'boise' | 'twin-falls';
        contractType: 'Original' | 'Revision' | 'Cancellation';
        salesperson: SalespersonInfo | null;
        finalFileName: string;
    };
    tempFileId: string;
}) {
    const { values, tempFileId } = params;
    const { client, market, finalFileName } = values;

    const finalName = finalFileName.toLowerCase().endsWith('.pdf') ? finalFileName : `${finalFileName}.pdf`;
    let finalFileDetails;
    const entryDate = new Date(); 

    try {
        finalFileDetails = await moveAndRenameFinalContract({
            fileId: tempFileId,
            client,
            fileName: finalName,
            market,
            entryDate,
        });

        if (!finalFileDetails.id) {
            throw new Error('Finalizing contract in Google Drive failed unexpectedly.');
        }
    } catch (error: any) {
        console.error('Error during Google Drive finalization:', error);
        return { success: false, error: `Failed to save file to Google Drive. ${getErrorMessage(error, 'file finalization')}` };
    }
    
    try {
        const newOrderData: Omit<Order, 'id'> = {
            ...values,
            finalFileName: finalName,
            pdfUrl: finalFileDetails.webViewLink,
            pdfFileId: finalFileDetails.id,
            status: 'Filed',
            orderEntryDate: entryDate,
            modifications: [{ date: entryDate, description: 'Initial creation.' }],
        };

        const collection = entryDate.getFullYear() < 2022 ? 'archived_orders' : 'orders';
        const newOrderId = await createOrder(newOrderData, collection);

        return { success: true, data: { id: newOrderId, ...newOrderData } };

    } catch (error: any) {
        console.error('Error creating Firestore document:', error);
        return { success: false, error: `File saved to Drive, but failed to create order in database. ${getErrorMessage(error, 'database write')}` };
    }
}

export async function appendFilesToContractAction(params: {
    orderId: string;
    pdfFileId: string;
    files: { dataUri: string; name: string; type: string }[];
    isArchived: boolean;
    contractType: 'Original' | 'Revision' | 'Cancellation';
}) {
    try {
        const { pdfFileId, files: newFiles, orderId, isArchived, contractType } = params;

        const existingPdfDataUri = await downloadDriveFile({ fileId: pdfFileId });
        if (!existingPdfDataUri) {
            throw new Error('Could not retrieve existing contract from Google Drive.');
        }

        const existingFile = { dataUri: existingPdfDataUri, mimeType: 'application/pdf', name: 'Existing Contract.pdf' };
        
        const allFilesToMerge = [existingFile, ...newFiles.map(f => ({ dataUri: f.dataUri, mimeType: f.type, name: f.name }))];
        const mergedPdfDataUri = await mergeFiles(allFilesToMerge);
        if (!mergedPdfDataUri) {
            throw new Error('File merging returned no data.');
        }

        await updateContractInDrive({
            fileId: pdfFileId,
            mergedPdfDataUri: mergedPdfDataUri,
        });
        
        const collection = isArchived ? 'archived_orders' : 'orders';

        // Update contract type and add modification log
        await updateOrder(orderId, { contractType }, collection);
        await appendOrderModification(orderId, `Appended ${newFiles.length} file(s) and set type to ${contractType}.`, collection);

        return { success: true };

    } catch (error: any) {
        console.error('Error in append files action:', error);
        return { success: false, error: `Failed to append files. ${getErrorMessage(error, 'file processing')}` };
    }
}

export async function getPagedOrdersAction(options: {
  limit: number;
  startAfterId?: string;
  includeArchived: boolean;
  includeOlder: boolean;
}) {
  try {
    const result = await getPagedOrders(options);
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Error getting paged orders:', error);
    return { success: false, error: getErrorMessage(error, 'fetching paged orders') };
  }
}

export async function updateOrderAction(orderId: string, updatedFields: Partial<Omit<Order, 'id'>>, isArchived: boolean) {
    const collection = isArchived ? 'archived_orders' : 'orders';
    try {
        // If market is being changed, we need to move the file in Google Drive.
        if (updatedFields.market) {
            const originalOrder = await getOrderById(orderId, collection);
            if (!originalOrder) {
                throw new Error(`Could not find original order with ID ${orderId} to update.`);
            }

            // This action is now triggered even if the market value is the same,
            // allowing a user to re-select a market to force a file move.
            await moveAndRenameFinalContract({
                fileId: originalOrder.pdfFileId,
                client: updatedFields.client || originalOrder.client,
                fileName: updatedFields.finalFileName || originalOrder.finalFileName,
                market: updatedFields.market,
                entryDate: updatedFields.orderEntryDate || originalOrder.orderEntryDate,
            });
        }

        await updateOrder(orderId, updatedFields, collection);
        await appendOrderModification(orderId, 'Updated fields.', collection); 
        return { success: true };
    } catch (error: any) {
        console.error('Error updating order:', error);
        return { success: false, error: getErrorMessage(error, 'updating order') };
    }
}

export async function deleteOrderAction(orderId: string, isArchived: boolean) {
    try {
        const collection = isArchived ? 'archived_orders' : 'orders';
        await deleteOrder(orderId, collection);
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting order:', error);
        return { success: false, error: getErrorMessage(error, 'deleting order') };
    }
}

export async function deleteOrdersAction(orderIds: string[], isArchived: boolean) {
    try {
        const collection = isArchived ? 'archived_orders' : 'orders';
        await deleteOrders(orderIds, collection);
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting orders:', error);
        return { success: false, error: getErrorMessage(error, 'deleting orders') };
    }
}

export async function bulkUpdateOrdersAction(orderIds: string[], updatedFields: Partial<Omit<Order, 'id'>>, isArchived: boolean) {
    const collection = isArchived ? 'archived_orders' : 'orders';
    try {
        await bulkUpdateOrders(orderIds, updatedFields, collection);
         const modificationPromises = orderIds.map(id => appendOrderModification(id, 'Bulk updated fields.', collection));
        await Promise.all(modificationPromises);
        return { success: true };
    } catch (error: any)
{
        console.error('Error bulk updating orders:', error);
        return { success: false, error: getErrorMessage(error, 'bulk updating orders') };
    }
}

export type CorrectionInfo = {
    orderId: string;
    pdfFileId: string;
    currentClient: string;
    proposedClient: string;
    isArchived: boolean;
    order: Order;
};

export async function countFixableOrdersAction(badClientName: string) {
    try {
        const count = await countFixableOrdersInDb(badClientName);
        return { success: true, data: count };
    } catch (error: any) {
        console.error('Error counting fixable orders:', error);
        return { success: false, error: getErrorMessage(error, 'counting fixable orders') };
    }
}

export async function getFixableOrdersBatchAction(badClientName: string, batchSize: number, startAfterId?: string) {
    try {
        const fixableOrders = await getPagedFixableOrders(badClientName, batchSize, startAfterId);
        return { success: true, data: fixableOrders };
    } catch (error: any) {
        console.error('Error scanning for fixable orders:', error);
        return { success: false, error: getErrorMessage(error, 'scanning for fixable orders') };
    }
}

export async function proposeCorrectionForSingleOrderAction(order: Order): Promise<{ success: boolean; data?: CorrectionInfo; error?: string }> {
    try {
        console.log(`Proposing correction for order ID: ${order.id}`);
        let proposedClient = order.client; 
        
        try {
            const pdfDataUri = await downloadDriveFile({ fileId: order.pdfFileId });
            const extractResult = await extractContractDetailsAction(pdfDataUri);

            if (extractResult.success && extractResult.data?.client) {
                proposedClient = extractResult.data.client;
                console.log(`AI proposed new client name "${proposedClient}" for order ${order.id}`);
            } else {
                 console.warn(`AI extraction failed for order ${order.id}: ${extractResult.error}`);
            }
        } catch (aiError: any) {
             console.error(`AI processing step failed for order ${order.id}:`, aiError.message);
             const errorInfo = getErrorMessage(aiError, 'proposing correction');
             return { 
                success: true, 
                error: errorInfo, 
                data: {
                    orderId: order.id,
                    pdfFileId: order.pdfFileId,
                    currentClient: order.client,
                    proposedClient: order.client, 
                    isArchived: order.orderEntryDate.getFullYear() < 2022,
                    order: order,
                }
            };
        }
        
        const correctionInfo: CorrectionInfo = {
            orderId: order.id,
            pdfFileId: order.pdfFileId,
            currentClient: order.client,
            proposedClient: proposedClient,
            isArchived: order.orderEntryDate.getFullYear() < 2022,
            order: order,
        };

        return { success: true, data: correctionInfo };

    } catch (error: any) {
        console.error(`Critical error proposing correction for order ${order.id}:`, error);
        return { success: false, error: getErrorMessage(error, 'proposing correction') };
    }
}

const processInChunks = async <T>(items: T[], chunkSize: number, processor: (chunk: T[]) => Promise<any>) => {
    for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        await processor(chunk);
    }
};

export async function correctOrdersAction(corrections: CorrectionInfo[]) {
    let successCount = 0;
    const errors: string[] = [];

    await processInChunks(corrections, 10, async (chunk) => {
        const promises = chunk.map(async (correction) => {
            try {
                const { orderId, proposedClient, isArchived, order } = correction;
                
                const collectionName = isArchived ? 'archived_orders' : 'orders';
                await updateOrder(orderId, { client: proposedClient }, collectionName);
                await appendOrderModification(orderId, `Client name corrected from "${correction.currentClient}" to "${proposedClient}".`, collectionName);

                await moveAndRenameFinalContract({
                    fileId: order.pdfFileId,
                    client: proposedClient,
                    fileName: order.finalFileName,
                    market: order.market,
                    entryDate: order.orderEntryDate,
                });
                successCount++;
            } catch (error: any) {
                console.error(`Failed to correct order ${correction.orderId}:`, error);
                errors.push(`Order ${correction.orderId}: ${error.message}`);
            }
        });
        await Promise.all(promises);
    });

    if (errors.length > 0) {
        return { success: false, error: `Completed with ${errors.length} errors. ${errors.join('; ')}`, data: { count: successCount } };
    }

    return { success: true, data: { count: successCount } };
}

export type { ImportableFile } from '@/services/google-drive';
import type { ImportableFile } from '@/services/google-drive';

export async function scanForImportableFilesAction(sourceFolderId: string, yearToScan: string) {
    try {
        const clientFolders = await scanForImportableFiles(sourceFolderId, yearToScan);
        
        for (const clientFolder of clientFolders) {
            if (!clientFolder.yearFolders.length) continue;

            for (const yearFolder of clientFolder.yearFolders) {
                if (!yearFolder.pdfs.length) continue;

                for (const pdf of yearFolder.pdfs) {
                    const order = await getOrderByPdfId(pdf.fileId);
                    if (!order) {
                        // Return the first un-imported file we find.
                        return { success: true, data: { files: [pdf], preview: pdf } };
                    }
                }
            }
        }
        
        // If we get through all folders and find nothing new.
        return { success: true, data: { files: [], preview: null } };

    } catch (error: any) {
        console.error('Error scanning for importable files:', error);
        return { success: false, error: getErrorMessage(error, 'scanning for importable files') };
    }
}

export type ProcessedItem = {
    file: ImportableFile;
    status: 'success' | 'error';
    message: string;
};

function parseDataFromFilename(filename: string): {
    entryDate: Date,
    stations: string[],
    contractNumber: string
} {
    // Split the filename to get the date part and handle various delimiters
    const datePart = filename.split(/[_ ]+/)[0];
    const dateDelimiters = /[-.\/]/;
    const parts = datePart.split(dateDelimiters);

    if (parts.length !== 3) {
        throw new Error('Could not parse date from filename.');
    }

    let year, month, day;

    if (parts[0].length === 4) { // YYYY-MM-DD
        [year, month, day] = [parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2])];
    } else if (parts[2].length === 4) { // MM-DD-YYYY
        [month, day, year] = [parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2])];
    } else if (parts[2].length === 2) { // MM-DD-YY
        [month, day, year] = [parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]) < 70 ? 2000 + parseInt(parts[2]) : 1900 + parseInt(parts[2])];
    } else {
        throw new Error('Ambiguous date format in filename.');
    }

    // new Date(year, monthIndex, day)
    // The month is 0-indexed in JavaScript's Date constructor.
    const entryDate = new Date(year, month - 1, day);

    if (isNaN(entryDate.getTime())) {
        throw new Error('Could not parse a valid date from filename.');
    }

    const allStations = ['KSRV', 'KSRV-HD2', 'KSRV HD2', 'KQBL', 'KQBL-HD2', 'KQBL HD2', 'KQBL-HD3', 'KQBL HD3', 'KZMG', 'KWYD', 'KKOO', 'KTPZ', 'KIKX', 'KIRQ', 'KYUN', 'KYUN-HD2', 'KYUN HD2', 'KYUN-HD3', 'KYUN HD3'];
    
    const foundStations: string[] = [];
    allStations.forEach(station => {
        const regex = new RegExp(`\\b${station.replace('-', '[- ]?')}\\b`, 'i');
        if (regex.test(filename)) {
            const normalizedStation = station.replace(/[- ]?HD/i, ' HD');
            if (!foundStations.includes(normalizedStation)) {
                 foundStations.push(normalizedStation);
            }
        }
    });

    let contractNumber = 'N/A - Imported';
    const contractMatch = filename.match(/#(\S+)/);
    if (contractMatch && contractMatch[1]) {
        contractNumber = contractMatch[1].replace(/\.pdf$/i, '').trim();
    }
    
    return {
        entryDate,
        stations: foundStations,
        contractNumber,
    };
}


export async function processSingleImportAction(
    file: ImportableFile, 
    market: 'boise' | 'twin-falls'
): Promise<{ success: boolean; message: string }> {
    try {
        let entryDate: Date;
        let stations: string[];
        let contractNumber: string;

        try {
            const parsedData = parseDataFromFilename(file.fileName);
            entryDate = parsedData.entryDate;
            stations = parsedData.stations;
            contractNumber = parsedData.contractNumber;
        } catch (e: any) {
            console.warn(`Could not parse data from filename for ${file.fileName}. Falling back to AI scan.`);
            try {
                const pdfDataUri = await downloadDriveFile({ fileId: file.fileId });
                const extractResult = await extractContractDate({ contractPdf: pdfDataUri });

                if (extractResult && extractResult.orderDate) {
                    const dateParts = extractResult.orderDate.split('-').map(part => parseInt(part, 10));
                    if (dateParts.length === 3) {
                        entryDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
                    } else {
                        throw new Error('AI returned an invalid date format.');
                    }
                } else {
                    throw new Error('AI could not extract a date.');
                }
                
                // When using AI for date, we have to accept defaults for other fields
                stations = [];
                contractNumber = 'N/A - Imported';

            } catch (aiError: any) {
                // If both filename parsing and AI fail, we archive the file.
                console.error(`AI fallback failed for ${file.fileName}: ${aiError.message}. Archiving file.`);
                await archiveFile({ fileId: file.fileId, fileName: file.fileName });
                return { success: false, message: `Skipped & Archived. Could not determine date.` };
            }
        }
        
        const finalFileDetails = await moveImportedFile({
            fileId: file.fileId,
            client: file.clientName,
            year: file.year,
            fileName: file.fileName,
            market: market,
        });

        if (!finalFileDetails.id || !finalFileDetails.webViewLink) {
            throw new Error('Failed to move file to final destination in Drive.');
        }

        const newOrderData: Omit<Order, 'id'> = {
            client: file.clientName, 
            agency: 'N/A - Imported',
            contractNumber: contractNumber,
            estimateNumber: 'N/A - Imported',
            stations: stations,
            market: market, 
            contractType: 'Original', 
            salesperson: null,
            finalFileName: file.fileName,
            pdfUrl: finalFileDetails.webViewLink,
            pdfFileId: finalFileDetails.id,
            status: 'Filed',
            orderEntryDate: entryDate, 
            modifications: [{ date: new Date(), description: 'Imported via Smart Tool.' }],
        };
        
        const collection = newOrderData.orderEntryDate.getFullYear() < 2022 ? 'archived_orders' : 'orders';
        await createOrder(newOrderData, collection);
        
        return { success: true, message: 'Imported successfully.' };

    } catch (error: any) {
        console.error(`Failed to process file ${file.fileName}:`, error);
        return { success: false, message: getErrorMessage(error, 'processing single import') };
    }
}

// Actions for Date Correction Tool

export type DateCorrectionInfo = {
    orderId: string;
    currentDate: Date;
    proposedDate: Date;
    isArchived: boolean;
    order: Order;
};

export async function countOrdersByDateAction(incorrectDate: string) {
    try {
        const count = await countOrdersByDateInDb(incorrectDate);
        return { success: true, data: count };
    } catch (error: any) {
        console.error('Error counting orders by date:', error);
        return { success: false, error: getErrorMessage(error, 'counting orders by date') };
    }
}

export async function getOrdersByDateBatchAction(incorrectDate: string, batchSize: number, startAfterId?: string) {
    try {
        const orders = await getPagedOrdersByDate(incorrectDate, batchSize, startAfterId);
        return { success: true, data: orders };
    } catch (error: any) {
        console.error('Error scanning for orders by date:', error);
        return { success: false, error: getErrorMessage(error, 'scanning for orders by date') };
    }
}

export async function proposeDateCorrectionForSingleOrderAction(order: Order): Promise<{ success: boolean; data?: DateCorrectionInfo; error?: string }> {
    try {
        let proposedDate: Date | null = null;
        let extractionError: string | null = null;

        try {
            const { entryDate } = parseDataFromFilename(order.finalFileName);
            proposedDate = entryDate;
        } catch (e: any) {
            // First attempt failed, now try the AI as a fallback
            console.warn(`Could not parse date from filename for ${order.id}. Falling back to AI scan.`);
            try {
                const pdfDataUri = await downloadDriveFile({ fileId: order.pdfFileId });
                const extractResult = await extractContractDate({ contractPdf: pdfDataUri });
                if (extractResult && extractResult.orderDate) {
                    // The date from AI is likely YYYY-MM-DD. Parsing this can have timezone issues.
                    // To avoid them, split the string and create a new Date object.
                    const dateParts = extractResult.orderDate.split('-').map(part => parseInt(part, 10));
                    if(dateParts.length === 3) {
                         // new Date(year, monthIndex, day)
                        proposedDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
                    } else {
                         throw new Error('AI returned an invalid date format.');
                    }
                } else {
                     throw new Error('AI could not extract a date.');
                }
            } catch (aiError: any) {
                 extractionError = `Filename parsing and AI scan both failed. Last error: ${aiError.message}`;
                 console.error(extractionError);
            }
        }
        
        if (!proposedDate) {
            return {
                success: true,
                error: extractionError || "Could not determine a new date.",
                data: {
                    orderId: order.id,
                    currentDate: order.orderEntryDate,
                    proposedDate: order.orderEntryDate,
                    isArchived: order.orderEntryDate.getFullYear() < 2022,
                    order: order,
                }
            };
        }

        const correctionInfo: DateCorrectionInfo = {
            orderId: order.id,
            currentDate: order.orderEntryDate,
            proposedDate: proposedDate,
            isArchived: order.orderEntryDate.getFullYear() < 2022,
            order: order,
        };

        return { success: true, data: correctionInfo };

    } catch (error: any) {
        console.error(`Critical error proposing date correction for order ${order.id}:`, error);
        return { success: false, error: getErrorMessage(error, 'proposing date correction') };
    }
}


export async function correctOrderDatesAction(corrections: DateCorrectionInfo[]) {
    let successCount = 0;
    const errors: string[] = [];

    await processInChunks(corrections, 10, async (chunk) => {
        const promises = chunk.map(async (correction) => {
            try {
                const { orderId, proposedDate, isArchived, order } = correction;
                
                const collectionName = isArchived ? 'archived_orders' : 'orders';
                await updateOrder(orderId, { orderEntryDate: proposedDate }, collectionName);
                await appendOrderModification(orderId, `Order date corrected from "${order.orderEntryDate.toISOString().split('T')[0]}" to "${proposedDate.toISOString().split('T')[0]}".`, collectionName);

                const currentYear = order.orderEntryDate.getFullYear().toString();
                const newYear = proposedDate.getFullYear().toString();

                if (currentYear !== newYear) {
                     await moveAndRenameFinalContract({
                        fileId: order.pdfFileId,
                        client: order.client,
                        fileName: order.finalFileName,
                        market: order.market,
                        entryDate: proposedDate,
                    });
                }
                successCount++;
            } catch (error: any) {
                console.error(`Failed to correct date for order ${correction.orderId}:`, error);
                errors.push(`Order ${correction.orderId}: ${error.message}`);
            }
        });
        await Promise.all(promises);
    });

    if (errors.length > 0) {
        return { success: false, error: `Completed with ${errors.length} errors. ${errors.join('; ')}`, data: { count: successCount } };
    }

    return { success: true, data: { count: successCount } };
}

export type FileToArchiveAction = {
    orderId: string;
    pdfFileId: string;
    finalFileName: string;
    isArchived: boolean;
};

export async function archiveFilesAction(filesToArchive: FileToArchiveAction[]) {
    let successCount = 0;
    const errors: string[] = [];

     await processInChunks(filesToArchive, 10, async (chunk) => {
        const promises = chunk.map(async (file) => {
            try {
                await archiveFile({
                    fileId: file.pdfFileId,
                    fileName: file.finalFileName,
                });
                const collectionName = file.isArchived ? 'archived_orders' : 'orders';
                await deleteOrderByIdAndCollection(file.orderId, collectionName);
                successCount++;
            } catch (error: any) {
                console.error(`Failed to archive file for order ${file.orderId}:`, error);
                errors.push(`Order ${file.orderId}: ${error.message}`);
            }
        });
        await Promise.all(promises);
    });
    
    if (errors.length > 0) {
        return { success: false, error: `Completed with ${errors.length} errors. ${errors.join('; ')}`, data: { count: successCount } };
    }

    return { success: true, data: { count: successCount } };
}

// Actions for Market Correction Tool

export type MarketCorrectionInfo = {
    order: Order;
    currentMarket: 'boise' | 'twin-falls';
    proposedMarket: 'boise' | 'twin-falls';
    isArchived: boolean;
};

export async function findMarketMismatchesAction(): Promise<{ success: boolean; data?: MarketCorrectionInfo[]; error?: string }> {
    try {
        const mismatches = await findMarketMismatches();
        return { success: true, data: mismatches };
    } catch (error: any) {
        console.error('Error finding market mismatches:', error);
        return { success: false, error: getErrorMessage(error, 'finding market mismatches') };
    }
}

export async function correctMarketMismatchesAction(corrections: MarketCorrectionInfo[]) {
    let successCount = 0;
    const errors: string[] = [];

    await processInChunks(corrections, 10, async (chunk) => {
        const promises = chunk.map(async (correction) => {
            try {
                const { order, proposedMarket, isArchived } = correction;
                const collectionName = isArchived ? 'archived_orders' : 'orders';
                
                // When we correct the market mismatch, we also need to move the file in GDrive.
                // The findMarketMismatches logic guarantees that the file is in the wrong place,
                // so we call moveAndRenameFinalContract to fix it.
                await moveAndRenameFinalContract({
                    fileId: order.pdfFileId,
                    client: order.client,
                    fileName: order.finalFileName,
                    market: proposedMarket,
                    entryDate: order.orderEntryDate,
                });
                
                await updateOrder(order.id, { market: proposedMarket }, collectionName);
                await appendOrderModification(order.id, `Market corrected from "${order.market}" to "${proposedMarket}".`, collectionName);
                
                successCount++;
            } catch (error: any) {
                console.error(`Failed to correct market for order ${correction.order.id}:`, error);
                errors.push(`Order ${correction.order.id}: ${error.message}`);
            }
        });
        await Promise.all(promises);
    });

    if (errors.length > 0) {
        return { success: false, error: `Completed with ${errors.length} errors. ${errors.join('; ')}`, data: { count: successCount } };
    }

    return { success: true, data: { count: successCount } };
}

// Actions for Dashboard

export async function getDashboardDataAction(): Promise<{ success: boolean, data?: DashboardData, error?: string }> {
    try {
        const data = await getDashboardData();
        return { success: true, data };
    } catch (error: any) {
        console.error('Error getting dashboard data:', error);
        return { success: false, error: getErrorMessage(error, 'fetching dashboard data') };
    }
}

export async function generateDashboardInsightsAction(data: DashboardData): Promise<{ success: boolean, data?: string, error?: string }> {
    try {
        const result = await generateDashboardInsights({ dashboardData: data });
        return { success: true, data: result.insights };
    } catch (error: any) {
        console.error('Error generating dashboard insights:', error);
        return { success: false, error: getErrorMessage(error, 'generating dashboard insights') };
    }
}

    