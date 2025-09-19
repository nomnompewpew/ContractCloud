
'use client';

import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PaginationProps extends React.ComponentProps<'nav'> {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  className,
  ...props
}: PaginationProps) => {

  const renderPageNumbers = () => {
    const pageNumbers = [];
    const maxPagesToShow = 5;
    const ellipsis = <PaginationEllipsis />;

    if (totalPages <= maxPagesToShow + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(
          <PaginationLink
            key={i}
            isActive={currentPage === i}
            onClick={() => onPageChange(i)}
          >
            {i}
          </PaginationLink>
        );
      }
    } else {
      pageNumbers.push(
        <PaginationLink
          key={1}
          isActive={currentPage === 1}
          onClick={() => onPageChange(1)}
        >
          1
        </PaginationLink>
      );

      if (currentPage > 3) {
        pageNumbers.push(React.cloneElement(ellipsis, { key: 'ellipsis-start' }));
      }

      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(totalPages - 1, currentPage + 1);

      if (currentPage <= 3) {
        startPage = 2;
        endPage = 4;
      }

      if (currentPage >= totalPages - 2) {
        startPage = totalPages - 3;
        endPage = totalPages - 1;
      }

      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(
          <PaginationLink
            key={i}
            isActive={currentPage === i}
            onClick={() => onPageChange(i)}
          >
            {i}
          </PaginationLink>
        );
      }

      if (currentPage < totalPages - 2) {
        pageNumbers.push(React.cloneElement(ellipsis, { key: 'ellipsis-end' }));
      }
      
      pageNumbers.push(
        <PaginationLink
          key={totalPages}
          isActive={currentPage === totalPages}
          onClick={() => onPageChange(totalPages)}
        >
          {totalPages}
        </PaginationLink>
      );
    }

    return pageNumbers;
  };

  return (
  <nav
    role="navigation"
    aria-label="pagination"
    className={cn('mx-auto flex w-full justify-center', className)}
    {...props}
  >
    <PaginationContent>
      <PaginationItem>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Previous</span>
        </Button>
      </PaginationItem>
      
      {renderPageNumbers()}

      <PaginationItem>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <span>Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </PaginationItem>
    </PaginationContent>
  </nav>
)};
Pagination.displayName = 'Pagination';

const PaginationContent = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<'ul'>
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn('flex flex-row items-center gap-1', className)}
    {...props}
  />
));
PaginationContent.displayName = 'PaginationContent';

const PaginationItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<'li'>
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn('', className)} {...props} />
));
PaginationItem.displayName = 'PaginationItem';

type PaginationLinkProps = {
  isActive?: boolean;
} & React.ComponentProps<typeof Button>;

const PaginationLink = ({
  isActive,
  size = 'icon',
  ...props
}: PaginationLinkProps) => (
  <PaginationItem>
    <Button
      variant={isActive ? 'outline' : 'ghost'}
      size={size}
      aria-current={isActive ? 'page' : undefined}
      {...props}
    />
  </PaginationItem>
);
PaginationLink.displayName = 'PaginationLink';

const PaginationEllipsis = ({
  className,
  ...props
}: React.ComponentProps<'span'>) => (
  <span
    aria-hidden
    className={cn('flex h-9 w-9 items-center justify-center', className)}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More pages</span>
  </span>
);
PaginationEllipsis.displayName = 'PaginationEllipsis';

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
};
