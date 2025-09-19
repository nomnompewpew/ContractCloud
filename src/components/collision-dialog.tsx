
'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Order } from '@/app/dashboard/page';

interface CollisionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  collisionInfo: {
    existingOrder: Order;
  } | null;
  onConfirmReplace: () => void;
}

export function CollisionDialog({ isOpen, onOpenChange, collisionInfo, onConfirmReplace }: CollisionDialogProps) {
  if (!collisionInfo) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Duplicate Order Number Detected</AlertDialogTitle>
          <AlertDialogDescription>
            An order with number{' '}
            <span className="font-bold text-foreground">{collisionInfo.existingOrder.orderNumber}</span> already exists.
            <br />
            <br />
            <span className="font-medium text-card-foreground">Existing Order Details:</span>
            <ul className="list-disc pl-5 text-muted-foreground text-sm mt-1">
              <li>Client: {collisionInfo.existingOrder.client}</li>
              <li>Agency: {collisionInfo.existingOrder.agency || 'N/A'}</li>
              <li>Salesperson: {collisionInfo.existingOrder.salesperson?.name || 'N/A'}</li>
              <li>Status: {collisionInfo.existingOrder.status}</li>
            </ul>
            <br />
            Do you want to delete the existing order and replace it with the one you are submitting?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel Submission</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirmReplace}
          >
            Replace Existing Order
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
