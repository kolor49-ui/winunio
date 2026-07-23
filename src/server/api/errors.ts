import { ZodError } from "zod";
import { DomainError } from "@/domain/types";
import { ApiError } from "@/server/api/http";

export function handleRouteError(error: unknown): Response {
  if (error instanceof DomainError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: 409 },
    );
  }
  if (error instanceof ApiError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Érvénytelen bemenet",
          details: error.flatten(),
        },
      },
      { status: 422 },
    );
  }
  if (error instanceof Error && error.message === "EMAIL_TAKEN") {
    return Response.json(
      { error: { code: "EMAIL_TAKEN", message: "Ez az e-mail már foglalt" } },
      { status: 409 },
    );
  }
  if (error instanceof Error && error.message === "DISPLAY_NAME_REQUIRED") {
    return Response.json(
      {
        error: {
          code: "DISPLAY_NAME_REQUIRED",
          message: "Név megadása kötelező named módban",
        },
      },
      { status: 422 },
    );
  }
  console.error(error);
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "Váratlan hiba" } },
    { status: 500 },
  );
}
