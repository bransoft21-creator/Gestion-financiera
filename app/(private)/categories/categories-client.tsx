"use client";

import { useMemo, useState } from "react";
import { FolderTree, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { z } from "zod";
import { EmptyState } from "@/components/app/empty-state";
import { ActionButton } from "@/components/ui-v2/action-button";
import {
  PremiumCard,
  PremiumCardContent,
  PremiumCardDescription,
  PremiumCardHeader,
  PremiumCardTitle,
} from "@/components/ui-v2/premium-card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CategoryType = "INCOME" | "EXPENSE" | "TRANSFER" | "DEBT" | "GOAL" | "INVESTMENT" | "ADJUSTMENT";

type CategoryItem = {
  id: string;
  name: string;
  type: CategoryType;
  color: string | null;
  icon: string | null;
  parentId: string | null;
  isSystem: boolean;
};

type CategoriesClientProps = {
  householdId: string;
  initialCategories: CategoryItem[];
};

type FormState = {
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
  parentId: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const categoryTypeLabels: Record<CategoryType, string> = {
  INCOME: "Ingreso",
  EXPENSE: "Gasto",
  TRANSFER: "Transferencia",
  DEBT: "Deuda",
  GOAL: "Ahorro / meta",
  INVESTMENT: "Inversión",
  ADJUSTMENT: "Ajuste",
};

const categoryTypes = Object.keys(categoryTypeLabels) as CategoryType[];

const categorySchema = z.object({
  name: z.string().trim().min(2, "Ingresá un nombre.").max(80),
  type: z.enum(categoryTypes),
  color: z.string().trim().max(32).optional(),
  icon: z.string().trim().max(64).optional(),
  parentId: z.string().optional(),
});

const defaultForm: FormState = {
  name: "",
  type: "EXPENSE",
  color: "#64748b",
  icon: "",
  parentId: "",
};

export function CategoriesClient({ householdId, initialCategories }: CategoriesClientProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const parentOptions = useMemo(() => {
    return categories.filter((category) => category.id !== editingCategoryId);
  }, [categories, editingCategoryId]);

  async function loadCategories() {
    setIsLoading(true);
    setMessage(null);

    const params = new URLSearchParams({
      householdId,
    });
    const response = await fetch(`/api/categories?${params.toString()}`);
    const payload = (await response.json()) as { data?: CategoryItem[]; error?: string };

    setIsLoading(false);

    if (!response.ok) {
      setMessage(payload.error ?? "No se pudieron cargar las categorías.");
      return;
    }

    setCategories(payload.data ?? []);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const parsed = categorySchema.safeParse(form);

    if (!parsed.success) {
      const nextErrors: FormErrors = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (typeof field === "string") {
          nextErrors[field as keyof FormState] = issue.message;
        }
      });
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setIsLoading(true);

    const url = editingCategoryId ? `/api/categories/${editingCategoryId}` : "/api/categories";
    const response = await fetch(url, {
      method: editingCategoryId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        householdId,
        name: parsed.data.name,
        type: parsed.data.type,
        color: parsed.data.color || (editingCategoryId ? null : undefined),
        icon: parsed.data.icon || (editingCategoryId ? null : undefined),
        parentId: parsed.data.parentId || (editingCategoryId ? null : undefined),
      }),
    });
    const payload = (await response.json()) as { error?: string };

    setIsLoading(false);

  if (!response.ok) {
      setMessage(payload.error ?? "No se pudo guardar la categoría.");
      return;
    }

    resetForm();
    setIsFormOpen(false);
    await loadCategories();
  }

  async function handleDelete(categoryId: string) {
    const shouldDelete = window.confirm("¿Eliminar esta categoría? Se aplicará soft delete.");

    if (!shouldDelete) {
      return;
    }

    setDeletingCategoryId(categoryId);
    setMessage(null);

    const response = await fetch(
      `/api/categories/${categoryId}?${new URLSearchParams({ householdId }).toString()}`,
      { method: "DELETE" },
    );
    const payload = (await response.json()) as { error?: string };

    setDeletingCategoryId(null);

    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo eliminar la categoría.");
      return;
    }

    if (editingCategoryId === categoryId) {
      resetForm();
    }

    await loadCategories();
  }

  function startEditing(category: CategoryItem) {
    setEditingCategoryId(category.id);
    setIsFormOpen(true);
    setErrors({});
    setMessage(null);
    setForm({
      name: category.name,
      type: category.type,
      color: category.color ?? "#64748b",
      icon: category.icon ?? "",
      parentId: category.parentId ?? "",
    });
  }

  function resetForm() {
    setEditingCategoryId(null);
    setErrors({});
    setForm(defaultForm);
    setMessage(null);
  }

  function updateForm<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <div className={`grid min-w-0 gap-6 ${isFormOpen ? "xl:grid-cols-[360px_1fr]" : ""}`}>
      {isFormOpen ? (
        <PremiumCard variant="raised">
          <PremiumCardHeader className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white">
                <Plus className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <PremiumCardTitle>{editingCategoryId ? "Editar categoría" : "Nueva categoría"}</PremiumCardTitle>
                <PremiumCardDescription>Clasificación financiera reusable.</PremiumCardDescription>
              </div>
              <ActionButton
                type="button"
                size="icon"
                variant="quiet"
                className="ml-auto h-9 w-9"
                onClick={() => {
                  resetForm();
                  setIsFormOpen(false);
                }}
                aria-label="Cerrar formulario"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </ActionButton>
            </div>
          </PremiumCardHeader>
          <PremiumCardContent className="px-4 pb-4">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Field label="Nombre" error={errors.name}>
              <Input className={inputClass} value={form.name} onChange={(event) => updateForm("name", event.target.value)} />
            </Field>

            <Field label="Tipo" error={errors.type}>
              <select
                className={selectClass}
                value={form.type}
                onChange={(event) => updateForm("type", event.target.value as CategoryType)}
              >
                {categoryTypes.map((type) => (
                  <option key={type} value={type}>
                    {categoryTypeLabels[type]}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid gap-3 sm:grid-cols-[80px_1fr]">
              <Field label="Color" error={errors.color}>
                <input
                  type="color"
                  className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.05] p-1"
                  value={form.color}
                  onChange={(event) => updateForm("color", event.target.value)}
                />
              </Field>
              <Field label="Icono" error={errors.icon}>
                <Input
                  className={inputClass}
                  value={form.icon}
                  onChange={(event) => updateForm("icon", event.target.value)}
                  placeholder="Ej: receipt"
                />
              </Field>
            </div>

            <Field label="Categoría padre" error={errors.parentId}>
              <select
                className={selectClass}
                value={form.parentId}
                onChange={(event) => updateForm("parentId", event.target.value)}
              >
                <option value="">Sin padre</option>
                {parentOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>

            {message ? <p className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-100">{message}</p> : null}

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <ActionButton className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {editingCategoryId ? "Guardar cambios" : "Crear categoría"}
              </ActionButton>
              {editingCategoryId ? (
                <ActionButton
                  type="button"
                  variant="glass"
                  className="w-full"
                  onClick={() => {
                    resetForm();
                    setIsFormOpen(false);
                  }}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  Cancelar
                </ActionButton>
              ) : null}
            </div>
          </form>
          </PremiumCardContent>
        </PremiumCard>
      ) : null}

      <PremiumCard>
        <PremiumCardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <PremiumCardTitle>Mapa de categorías</PremiumCardTitle>
              <PremiumCardDescription>{categories.length} categorías activas.</PremiumCardDescription>
            </div>
            <ActionButton
              type="button"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => {
                resetForm();
                setIsFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nueva categoría
            </ActionButton>
          </div>
        </PremiumCardHeader>
        <PremiumCardContent>
          {categories.length === 0 ? (
            <EmptyState
              icon={FolderTree}
              title="Todavía no hay categorías."
              description="Las categorías dan sentido a cada movimiento. Creá la primera."
            />
          ) : (
            <div className="grid gap-1.5 md:grid-cols-2">
              {categories.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  parentName={categories.find((item) => item.id === category.parentId)?.name}
                  isDeleting={deletingCategoryId === category.id}
                  onEdit={startEditing}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </PremiumCardContent>
      </PremiumCard>
    </div>
  );
}

const inputClass = "v2-focus-ring h-11 rounded-2xl border-white/10 bg-white/[0.05] text-white placeholder:text-zinc-600";
const selectClass = "v2-focus-ring h-11 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none transition hover:bg-white/[0.07]";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold uppercase text-zinc-500">{label}</Label>
      {children}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}

function CategoryCard({
  category,
  parentName,
  isDeleting,
  onEdit,
  onDelete,
}: {
  category: CategoryItem;
  parentName?: string;
  isDeleting: boolean;
  onEdit: (category: CategoryItem) => void;
  onDelete: (categoryId: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] px-3 py-2.5 transition duration-200 hover:border-white/[0.16] hover:bg-white/[0.055]">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => onEdit(category)}
        >
          <span
            className="h-3 w-3 shrink-0 rounded-sm"
            style={{ backgroundColor: category.color ?? "#64748b" }}
          />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-xs font-semibold text-white sm:text-sm">{category.name}</p>
              {parentName ? <span className="truncate text-[11px] text-zinc-500">· {parentName}</span> : null}
            </div>
            <div className="mt-1 flex min-w-0 items-center gap-1.5 overflow-hidden">
              <Badge className="h-5 shrink-0 border-white/10 bg-white/[0.06] px-1.5 py-0 text-[10px] text-zinc-200">{categoryTypeLabels[category.type]}</Badge>
              <Badge className="h-5 shrink-0 border-white/10 bg-white/[0.06] px-1.5 py-0 text-[10px] text-zinc-200">{category.isSystem ? "Base" : "Personal"}</Badge>
              {category.icon ? <Badge className="h-5 shrink-0 border-white/10 bg-white/[0.06] px-1.5 py-0 text-[10px] text-zinc-200">{category.icon}</Badge> : null}
            </div>
          </div>
        </button>
        <ActionButton
          type="button"
          variant="quiet"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground"
          onClick={() => onEdit(category)}
          aria-label="Editar categoría"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </ActionButton>
        <ActionButton
          type="button"
          variant="danger"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={isDeleting}
          onClick={() => onDelete(category.id)}
          aria-label="Eliminar categoría"
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          )}
        </ActionButton>
      </div>
    </div>
  );
}
