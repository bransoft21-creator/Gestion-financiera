"use client";

import { useMemo, useState } from "react";
import { FolderTree, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { z } from "zod";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
        <Card>
          <CardHeader className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Plus className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <CardTitle>{editingCategoryId ? "Editar categoría" : "Nueva categoría"}</CardTitle>
                <CardDescription>Clasificación financiera reusable.</CardDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-auto h-9 w-9"
                onClick={() => {
                  resetForm();
                  setIsFormOpen(false);
                }}
                aria-label="Cerrar formulario"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Field label="Nombre" error={errors.name}>
              <Input value={form.name} onChange={(event) => updateForm("name", event.target.value)} />
            </Field>

            <Field label="Tipo" error={errors.type}>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                  className="h-10 w-full rounded-md border border-input bg-background p-1"
                  value={form.color}
                  onChange={(event) => updateForm("color", event.target.value)}
                />
              </Field>
              <Field label="Icono" error={errors.icon}>
                <Input
                  value={form.icon}
                  onChange={(event) => updateForm("icon", event.target.value)}
                  placeholder="Ej: receipt"
                />
              </Field>
            </div>

            <Field label="Categoría padre" error={errors.parentId}>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

            {message ? <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{message}</p> : null}

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <Button className="h-11 w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {editingCategoryId ? "Guardar cambios" : "Crear categoría"}
              </Button>
              {editingCategoryId ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full"
                  onClick={() => {
                    resetForm();
                    setIsFormOpen(false);
                  }}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  Cancelar
                </Button>
              ) : null}
            </div>
          </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Listado</CardTitle>
              <CardDescription>{categories.length} categorías activas.</CardDescription>
            </div>
            <Button
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
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <EmptyState
              icon={FolderTree}
              title="Sin categorías"
              description="Creá categorías para clasificar ingresos, gastos, deudas, metas e inversiones."
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
        </CardContent>
      </Card>
    </div>
  );
}

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
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
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
    <div className="rounded-lg border border-border bg-card px-2.5 py-2 transition-all duration-200 hover:border-border/80">
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
              <p className="truncate text-xs font-semibold sm:text-sm">{category.name}</p>
              {parentName ? <span className="truncate text-[11px] text-muted-foreground">· {parentName}</span> : null}
            </div>
            <div className="mt-1 flex min-w-0 items-center gap-1.5 overflow-hidden">
              <Badge className="h-5 shrink-0 px-1.5 py-0 text-[10px]">{categoryTypeLabels[category.type]}</Badge>
              <Badge className="h-5 shrink-0 px-1.5 py-0 text-[10px]">{category.isSystem ? "Base" : "Personal"}</Badge>
              {category.icon ? <Badge className="h-5 shrink-0 px-1.5 py-0 text-[10px]">{category.icon}</Badge> : null}
            </div>
          </div>
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground"
          onClick={() => onEdit(category)}
          aria-label="Editar categoría"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={isDeleting}
          onClick={() => onDelete(category.id)}
          aria-label="Eliminar categoría"
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>
    </div>
  );
}
