import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { ApiError, FieldApiError } from "./errors";
import { logEvent } from "./logging";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function created<T>(data: T) {
  return ok(data, { status: 201 });
}

export function handleApiError(error: unknown) {
  if (error instanceof FieldApiError) {
    return NextResponse.json(
      { error: error.message, fieldErrors: error.fieldErrors },
      { status: error.status },
    );
  }

  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof ZodError) {
    const fieldErrors = error.issues.reduce<Record<string, string>>((fields, issue) => {
      const field = issue.path[0];

      if (typeof field === "string" && !fields[field]) {
        fields[field] = issue.message;
      }

      return fields;
    }, {});

    return NextResponse.json(
      {
        error: "Revisá los campos marcados.",
        fieldErrors,
        issues: error.issues,
      },
      { status: 400 },
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Ya existe un registro con esos datos para este período." },
        { status: 409 },
      );
    }
  }

  logEvent("error", "api.unhandled_error", {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : "Unknown error",
  });

  return NextResponse.json(
    {
      error: "Ocurrió un error inesperado. Intentá nuevamente.",
    },
    { status: 500 },
  );
}
