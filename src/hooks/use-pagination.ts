
'use client';

import { useState, useCallback } from 'react';

interface UsePaginationProps {
  pageSize: number;
}

export function usePagination({ pageSize }: UsePaginationProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  // Stores the ID of the last document of each page, to be used as a 'startAfter' cursor
  const [pageCursors, setPageCursors] = useState<Record<number, string | undefined>>({ 1: undefined });

  const goToNextPage = useCallback(() => {
    setCurrentPage(prev => (prev < totalPages ? prev + 1 : prev));
  }, [totalPages]);

  const goToPreviousPage = useCallback(() => {
    setCurrentPage(prev => (prev > 1 ? prev - 1 : prev));
  }, []);

  return {
    currentPage,
    setCurrentPage,
    totalPages,
    setTotalPages,
    pageCursors,
    setPageCursors,
    goToNextPage,
    goToPreviousPage,
  };
}
