"use client";

import { ChevronDown, CreditCard, Filter, Loader2, Plus, Search } from "lucide-react";
import { ActionButton } from "@/components/ui-v2/action-button";
import { PremiumCard, PremiumCardContent, PremiumCardHeader } from "@/components/ui-v2/premium-card";
import { Input } from "@/components/ui/input";
import { compactSelectClass, transactionTypeLabels, transactionTypes } from "./constants";
import { Field } from "./field";
import type { CategoryOption, Filters } from "./types";

export function TransactionFilters({
  search,
  filters,
  categories,
  activeFilterCount,
  isFiltersOpen,
  isLoading,
  onSearchChange,
  onFiltersChange,
  onToggleFilters,
  onSubmit,
  onClearFilters,
  onNew,
  onPayCreditCard,
}: {
  search: string;
  filters: Filters;
  categories: CategoryOption[];
  activeFilterCount: number;
  isFiltersOpen: boolean;
  isLoading: boolean;
  onSearchChange: (value: string) => void;
  onFiltersChange: (filters: Filters) => void;
  onToggleFilters: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClearFilters: () => void;
  onNew: () => void;
  onPayCreditCard?: () => void;
}) {
  return (
    <PremiumCard className="sticky top-2 z-20 overflow-hidden border-border/80 bg-background/95 backdrop-blur lg:static">
      <PremiumCardHeader className="border-b border-border/60 bg-muted/[0.08] p-3 sm:p-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              className="h-10 min-w-0 rounded-2xl border-border/80 bg-background/60 pl-8 text-base transition focus:bg-background md:text-xs"
              placeholder="Buscar movimiento..."
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>
          <ActionButton
            type="button"
            variant={activeFilterCount > 0 ? "glass" : "quiet"}
            size="sm"
            className="shrink-0"
            onClick={onToggleFilters}
            aria-expanded={isFiltersOpen}
          >
            <Filter className="h-3.5 w-3.5" aria-hidden="true" />
            {activeFilterCount > 0 ? activeFilterCount : "Filtros"}
            <ChevronDown className={`h-3.5 w-3.5 transition ${isFiltersOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </ActionButton>
          <ActionButton type="button" size="sm" className="shrink-0" onClick={onNew}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Nueva
          </ActionButton>
        </div>
        {onPayCreditCard ? (
          <div className="mt-2">
            <ActionButton type="button" variant="quiet" size="sm" onClick={onPayCreditCard}>
              <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
              Pagar tarjeta
            </ActionButton>
          </div>
        ) : null}
      </PremiumCardHeader>
      {isFiltersOpen ? (
        <PremiumCardContent className="px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
          <form className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-5" onSubmit={onSubmit}>
            <Field label="Tipo">
              <select
                className={compactSelectClass}
                value={filters.type}
                onChange={(event) => onFiltersChange({ ...filters, type: event.target.value })}
              >
                <option value="">Todos</option>
                {transactionTypes.map((type) => (
                  <option key={type} value={type}>
                    {transactionTypeLabels[type]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Categoría">
              <select
                className={compactSelectClass}
                value={filters.categoryId}
                onChange={(event) => onFiltersChange({ ...filters, categoryId: event.target.value })}
              >
                <option value="">Todas</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Desde">
              <Input
                className="h-9 text-base md:text-xs"
                type="date"
                value={filters.from}
                onChange={(event) => onFiltersChange({ ...filters, from: event.target.value })}
              />
            </Field>
            <Field label="Hasta">
              <Input
                className="h-9 text-base md:text-xs"
                type="date"
                value={filters.to}
                onChange={(event) => onFiltersChange({ ...filters, to: event.target.value })}
              />
            </Field>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
              <ActionButton size="sm" className="flex-1" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                Aplicar
              </ActionButton>
              {activeFilterCount > 0 ? (
                <ActionButton type="button" variant="quiet" size="sm" onClick={onClearFilters}>
                  Limpiar
                </ActionButton>
              ) : null}
            </div>
          </form>
        </PremiumCardContent>
      ) : null}
    </PremiumCard>
  );
}
