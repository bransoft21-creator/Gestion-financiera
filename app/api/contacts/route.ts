import { NextRequest } from "next/server";
import { created, handleApiError, ok } from "../../../server/api/http";
import { getCurrentUser } from "../../../server/auth/current-user";
import { createContactSchema, listContactsSchema, updateContactSchema } from "../../../server/schemas/person-contacts";
import { createContact, listContacts, updateContact } from "../../../server/services/person-contacts";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = listContactsSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const contacts = await listContacts(userProfile.id, input);
    return ok(contacts);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = createContactSchema.parse(await request.json());
    const contact = await createContact(userProfile.id, input);
    return created(contact);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = updateContactSchema.parse(await request.json());
    const contact = await updateContact(userProfile.id, input);
    return ok(contact);
  } catch (error) {
    return handleApiError(error);
  }
}
