

import { 
    collection, 
    doc, 
    addDoc, 
    getDocs, 
    updateDoc, 
    deleteDoc, 
    writeBatch,
    Timestamp,
    arrayUnion,
    query,
    orderBy,
    where,
    limit,
    startAfter,
    getCountFromServer,
    getDoc,
    type DocumentData,
    type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, OrderDocument, MarketCorrectionInfo } from '@/app/dashboard/page';
import { parseISO, startOfDay, endOfDay, isValid, subDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { getFileParentIds } from './google-drive';


const ordersCollectionRef = collection(db, 'orders');
const archivedOrdersCollectionRef = collection(db, 'archived_orders');


function toOrder(doc: QueryDocumentSnapshot<DocumentData>): Order {
    const data = doc.data() as OrderDocument;

    // Robust date parsing
    let entryDate: Date;
    if (data.orderEntryDate instanceof Timestamp) {
        entryDate = data.orderEntryDate.toDate();
    } else if (typeof data.orderEntryDate === 'string' || typeof data.orderEntryDate === 'number') {
        entryDate = new Date(data.orderEntryDate);
    } else {
        // Fallback for unexpected formats
        console.warn(`Unexpected date format for order ${doc.id}:`, data.orderEntryDate);
        entryDate = new Date(); 
    }

    const modifications = (data.modifications || []).map(mod => {
        let modDate: Date;
        if (mod.date instanceof Timestamp) {
            modDate = mod.date.toDate();
        } else if (typeof mod.date === 'string' || typeof mod.date === 'number') {
            modDate = new Date(mod.date);
        } else {
            modDate = new Date();
        }
        return { ...mod, date: modDate };
    });

    return {
        id: doc.id,
        ...data,
        orderEntryDate: entryDate,
        modifications: modifications,
    };
}

export async function createOrder(orderData: Omit<Order, 'id'>, collectionName: 'orders' | 'archived_orders' = 'orders'): Promise<string> {
    const targetCollection = collection(db, collectionName);
    const docRef = await addDoc(targetCollection, {
        ...orderData,
        orderEntryDate: Timestamp.fromDate(orderData.orderEntryDate),
        modifications: [{
            date: Timestamp.now(),
            description: 'Initial creation.'
        }]
    });
    return docRef.id;
}

export async function getPagedOrders(options: {
  limit: number;
  startAfterId?: string;
  includeArchived: boolean;
  includeOlder: boolean;
}): Promise<Order[]> {
  const { limit: limitValue, startAfterId, includeArchived, includeOlder } = options;

  let collectionRef = ordersCollectionRef;
  if (includeArchived) {
    collectionRef = archivedOrdersCollectionRef;
  }

  const queryConstraints = [];

  if (!includeOlder && !includeArchived) {
    const startDate = subDays(new Date(), 365);
    queryConstraints.push(where('orderEntryDate', '>=', startDate));
  }

  queryConstraints.push(orderBy('orderEntryDate', 'desc'));
  
  if (startAfterId) {
    const docRef = doc(db, collectionRef.path, startAfterId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      queryConstraints.push(startAfter(docSnap));
    }
  }

  queryConstraints.push(limit(limitValue));

  const q = query(collectionRef, ...queryConstraints);

  const snapshot = await getDocs(q);
  return snapshot.docs.map(toOrder);
}


export async function getOrdersByClient(clientName: string): Promise<Order[]> {
    const allOrders: Order[] = [];
    const collectionsToQuery = [ordersCollectionRef, archivedOrdersCollectionRef];

    for (const coll of collectionsToQuery) {
        const q = query(coll, where('client', '==', clientName));
        const snapshot = await getDocs(q);
        allOrders.push(...snapshot.docs.map(toOrder));
    }
    
    // Sort in-app instead of in the query
    allOrders.sort((a, b) => b.orderEntryDate.getTime() - a.orderEntryDate.getTime());
    
    return allOrders;
}

export async function getOrderById(orderId: string, collectionName: 'orders' | 'archived_orders'): Promise<Order | null> {
    const orderRef = doc(db, collectionName, orderId);
    const docSnap = await getDoc(orderRef);

    if (docSnap.exists()) {
        return toOrder(docSnap as QueryDocumentSnapshot<DocumentData>);
    } else {
        // If not found in the primary collection, check the other one if needed.
        const otherCollectionName = collectionName === 'orders' ? 'archived_orders' : 'orders';
        const otherOrderRef = doc(db, otherCollectionName, orderId);
        const otherDocSnap = await getDoc(otherOrderRef);
        if (otherDocSnap.exists()) {
            return toOrder(otherDocSnap as QueryDocumentSnapshot<DocumentData>);
        }
    }
    return null;
}


export async function getPagedFixableOrders(clientName: string, batchSize: number, startAfterId?: string): Promise<Order[]> {
    const allOrders: Order[] = [];
    
    let startAfterDoc;
    if (startAfterId) {
        let startDocSnapshot = await getDoc(doc(db, 'orders', startAfterId)).catch(() => null);
        if (!startDocSnapshot?.exists()) {
             startDocSnapshot = await getDoc(doc(db, 'archived_orders', startAfterId)).catch(() => null);
        }
        
        if(startDocSnapshot?.exists()) {
            startAfterDoc = startDocSnapshot;
        }
    }

    const collectionsToQuery = [ordersCollectionRef, archivedOrdersCollectionRef];

    for (const coll of collectionsToQuery) {
        if (allOrders.length >= batchSize) break;

        let q = query(coll, where('client', '==', clientName), orderBy('__name__'), limit(batchSize));
        
        if (startAfterDoc && startAfterDoc.ref.parent.id === coll.id) {
            q = query(coll, where('client', '==', clientName), orderBy('__name__'), startAfter(startAfterDoc), limit(batchSize));
        }

        const snapshot = await getDocs(q);
        const docs = snapshot.docs;

        for (const doc of docs) {
            if (allOrders.length < batchSize) {
                allOrders.push(toOrder(doc));
            } else {
                break;
            }
        }
    }
    
    // Sort by document ID to ensure consistent order across batches
    allOrders.sort((a, b) => a.id.localeCompare(b.id));

    return allOrders.slice(0, batchSize);
}


export async function countFixableOrders(clientName: string): Promise<number> {
    let totalCount = 0;
    const collectionsToQuery = [ordersCollectionRef, archivedOrdersCollectionRef];

    for (const coll of collectionsToQuery) {
        const q = query(coll, where('client', '==', clientName));
        const snapshot = await getCountFromServer(q);
        totalCount += snapshot.data().count;
    }
    return totalCount;
}

export async function getOrderByPdfId(pdfFileId: string): Promise<Order | null> {
    const collectionsToQuery = [ordersCollectionRef, archivedOrdersCollectionRef];
    for (const coll of collectionsToQuery) {
        const q = query(coll, where('pdfFileId', '==', pdfFileId), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            return toOrder(snapshot.docs[0]);
        }
    }
    return null;
}


export async function updateOrder(orderId: string, updatedFields: Partial<Omit<Order, 'id'>>, collectionName: 'orders' | 'archived_orders'): Promise<void> {
    const orderRef = doc(db, collectionName, orderId);
    const dataToUpdate: any = { ...updatedFields };

    // Convert Date objects back to Timestamps for Firestore
    if (updatedFields.orderEntryDate) {
        dataToUpdate.orderEntryDate = Timestamp.fromDate(updatedFields.orderEntryDate);
    }
    
    await updateDoc(orderRef, dataToUpdate);
}

export async function appendOrderModification(orderId: string, description: string, collectionName: 'orders' | 'archived_orders'): Promise<void> {
    const orderRef = doc(db, collectionName, orderId);
    const modification = {
        date: Timestamp.now(),
        description: description,
    };
    await updateDoc(orderRef, {
        modifications: arrayUnion(modification)
    });
}

export async function deleteOrder(orderId: string, collectionName: 'orders' | 'archived_orders'): Promise<void> {
    const orderRef = doc(db, collectionName, orderId);
    await deleteDoc(orderRef);
}

export async function deleteOrderByIdAndCollection(orderId: string, collectionName: 'orders' | 'archived_orders'): Promise<void> {
    const orderRef = doc(db, collectionName, orderId);
    await deleteDoc(orderRef);
}

export async function deleteOrders(orderIds: string[], collectionName: 'orders' | 'archived_orders'): Promise<void> {
    const batch = writeBatch(db);
    orderIds.forEach(id => {
        const orderRef = doc(db, collectionName, id);
        batch.delete(orderRef);
    });
    await batch.commit();
}

export async function bulkUpdateOrders(orderIds: string[], updatedFields: Partial<Omit<Order, 'id'>>, collectionName: 'orders' | 'archived_orders'): Promise<void> {
    const batch = writeBatch(db);
    const dataToUpdate: any = { ...updatedFields };

     if (updatedFields.orderEntryDate) {
        dataToUpdate.orderEntryDate = Timestamp.fromDate(updatedFields.orderEntryDate);
    }

    orderIds.forEach(id => {
        const orderRef = doc(db, collectionName, id);
        batch.update(orderRef, dataToUpdate);
    });
    await batch.commit();
}


// --- Functions for Date Correction Tool ---

const getUtcRangeFromDateString = (dateString: string) => {
    // We get a string like '2023-11-21'. We want to treat this as a literal date
    // and create a range for that entire day, regardless of local timezones.
    const timeZone = 'America/Denver'; // MST/MDT
    const date = parseISO(dateString);

    if(!isValid(date)) {
        throw new Error(`Invalid date string provided: ${dateString}`);
    }

    const zonedDate = toZonedTime(date, timeZone);
    const dayStart = startOfDay(zonedDate);
    const dayEnd = endOfDay(zonedDate);

    // Convert to Firestore Timestamps for the query
    return { 
        start: Timestamp.fromDate(dayStart), 
        end: Timestamp.fromDate(dayEnd) 
    };
};

export async function countOrdersByDate(dateString: string): Promise<number> {
    const { start, end } = getUtcRangeFromDateString(dateString);

    let totalCount = 0;
    const collectionsToQuery = [ordersCollectionRef, archivedOrdersCollectionRef];

    for (const coll of collectionsToQuery) {
        const q = query(coll, where('orderEntryDate', '>=', start), where('orderEntryDate', '<=', end));
        const snapshot = await getCountFromServer(q);
        totalCount += snapshot.data().count;
    }
    return totalCount;
}

export async function getPagedOrdersByDate(dateString: string, batchSize: number, startAfterId?: string): Promise<Order[]> {
    const { start, end } = getUtcRangeFromDateString(dateString);

    const allOrders: Order[] = [];
    
    let startAfterDoc;
    if (startAfterId) {
        let startDocSnapshot = await getDoc(doc(db, 'orders', startAfterId)).catch(() => null);
        if (!startDocSnapshot?.exists()) {
             startDocSnapshot = await getDoc(doc(db, 'archived_orders', startAfterId)).catch(() => null);
        }
        if(startDocSnapshot?.exists()) {
            startAfterDoc = startDocSnapshot;
        }
    }

    const collectionsToQuery = [ordersCollectionRef, archivedOrdersCollectionRef];

    for (const coll of collectionsToQuery) {
        if (allOrders.length >= batchSize) break;

        let q = query(coll, 
            where('orderEntryDate', '>=', start), 
            where('orderEntryDate', '<=', end), 
            orderBy('orderEntryDate'), 
            orderBy('__name__'), 
            limit(batchSize)
        );
        
        if (startAfterDoc && startAfterDoc.ref.parent.id === coll.id) {
             q = query(coll, 
                where('orderEntryDate', '>=', start), 
                where('orderEntryDate', '<=', end), 
                orderBy('orderEntryDate'),
                orderBy('__name__'),
                startAfter(startAfterDoc),
                limit(batchSize)
            );
        }

        const snapshot = await getDocs(q);
        const docs = snapshot.docs;

        for (const doc of docs) {
            if (allOrders.length < batchSize) {
                allOrders.push(toOrder(doc));
            } else {
                break;
            }
        }
    }
    
    allOrders.sort((a, b) => a.id.localeCompare(b.id));

    return allOrders.slice(0, batchSize);
}

// --- Functions for Market Correction Tool ---

// This is a helper function to recursively check if a folder is a descendant of a root folder.
async function isDescendant(childId: string, ancestorId: string): Promise<boolean> {
    if (childId === ancestorId) return true;
    
    const parentIds = await getFileParentIds(childId);
    if (!parentIds || parentIds.length === 0) return false;
    
    // A file can have multiple parents. We only need one path to trace back to the ancestor.
    for (const parentId of parentIds) {
        if (await isDescendant(parentId, ancestorId)) {
            return true;
        }
    }
    
    return false;
}

export async function findMarketMismatches(): Promise<MarketCorrectionInfo[]> {
    const boiseFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!boiseFolderId) {
        throw new Error("The Boise folder ID (GOOGLE_DRIVE_FOLDER_ID) must be set in the .env file.");
    }
    
    const mismatches: MarketCorrectionInfo[] = [];
    const collectionsToQuery = [
        { ref: ordersCollectionRef, isArchived: false },
        { ref: archivedOrdersCollectionRef, isArchived: true }
    ];

    for (const collectionInfo of collectionsToQuery) {
        // 1. Query for documents specifically marked as 'twin-falls' in the database.
        const q = query(collectionInfo.ref, where('market', '==', 'twin-falls'));
        const snapshot = await getDocs(q);
        
        for (const doc of snapshot.docs) {
            const order = toOrder(doc);
            if (!order.pdfFileId) continue;
            
            try {
                const parentIds = await getFileParentIds(order.pdfFileId);
                if (!parentIds || parentIds.length === 0) continue;

                // 2. Check if the file is actually located within the Boise folder structure.
                const isActuallyInBoise = await isDescendant(parentIds[0], boiseFolderId);
                
                // 3. If it is, we have a mismatch. The DB says Twin Falls, but the file is in Boise.
                if (isActuallyInBoise) {
                    mismatches.push({
                        order: order,
                        currentMarket: 'twin-falls', // We know this from the query
                        proposedMarket: 'boise',    // We propose to fix the DB to match the file's actual location
                        isArchived: collectionInfo.isArchived,
                    });
                }
            } catch (error) {
                console.error(`Could not verify market for order ${order.id}. Skipping. Error:`, error);
            }
        }
    }

    return mismatches;
}

// --- Functions for Dashboard ---

type DailyStats = {
    total: number;
    revisions: number;
    cancellations: number;
    byMarket: Record<string, number>;
    orders: Order[];
}

export type DashboardData = {
    daily: DailyStats;
    weekly: DailyStats;
    monthly: DailyStats;
};

async function getStatsForDateRange(startDate: Date, endDate: Date): Promise<DailyStats> {
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);

    const q = query(
        ordersCollectionRef,
        where('orderEntryDate', '>=', startTimestamp),
        where('orderEntryDate', '<=', endTimestamp),
        orderBy('orderEntryDate', 'desc')
    );

    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(toOrder);

    const stats: DailyStats = {
        total: orders.length,
        revisions: orders.filter(o => o.contractType === 'Revision').length,
        cancellations: orders.filter(o => o.contractType === 'Cancellation').length,
        byMarket: { boise: 0, 'twin-falls': 0 },
        orders: orders,
    };

    for (const order of orders) {
        if (order.market) {
            stats.byMarket[order.market] = (stats.byMarket[order.market] || 0) + 1;
        }
    }

    return stats;
}

export async function getDashboardData(): Promise<DashboardData> {
    const timeZone = 'America/Denver';
    const now = toZonedTime(new Date(), timeZone);
    
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    
    const weeklyStart = startOfDay(subDays(now, 6)); // Today + previous 6 days
    const monthlyStart = startOfDay(subDays(now, 29)); // Today + previous 29 days

    const [daily, weekly, monthly] = await Promise.all([
        getStatsForDateRange(todayStart, todayEnd),
        getStatsForDateRange(weeklyStart, todayEnd),
        getStatsForDateRange(monthlyStart, todayEnd),
    ]);
    
    return { daily, weekly, monthly };
}
    

    